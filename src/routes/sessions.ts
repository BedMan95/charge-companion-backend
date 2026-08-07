import { Hono } from 'hono';
import { getDb } from '../db/client';
import { chargingSessions, userVehicles, plnTariffs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ChargingCalculator } from '../utils/charging_calculator';

const sessionsRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

sessionsRoutes.get('/history/:userId', async (c) => {
  const db = getDb(c.env);
  const userId = c.req.param('userId');
  const limit = Number(c.req.query('limit')) || 10;
  const offset = Number(c.req.query('offset')) || 0;

  const history = await db.select()
    .from(chargingSessions)
    .where(eq(chargingSessions.userId, userId))
    .orderBy(desc(chargingSessions.startTime))
    .limit(limit)
    .offset(offset);

  return c.json(history);
});

// Endpoint untuk mendapatkan metrics/ETA secara live oleh Frontend
sessionsRoutes.get('/metrics/:id', async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  const currentWattage = Number(c.req.query('watt')) || 0; // Didapat frontend dari API Tuya (atau proxy)

  const data = await db
    .select({
      session: chargingSessions,
      vehicle: userVehicles,
      tariff: plnTariffs
    })
    .from(chargingSessions)
    .leftJoin(userVehicles, eq(chargingSessions.vehicleId, userVehicles.id))
    .leftJoin(plnTariffs, eq(chargingSessions.userId, plnTariffs.userId))
    .where(eq(chargingSessions.id, id))
    .get();

  if (!data) return c.json({ error: 'Session not found' }, 404);

  const { session, vehicle, tariff } = data;

  // 1. Hitung ulang Current Percentage secara live dari db (mengantisipasi jeda cron)
  const batCapacityKwh = (session.batteryVolt * session.batteryAh) / 1000.0;
  const energyDcChargedKwh = (session.accumulatedEnergy * session.efisiensiCharger) / 1000.0;
  const addedPercentage = (energyDcChargedKwh / batCapacityKwh) * 100;
  const currentPercent = Math.min(session.persenAwal + addedPercentage, session.persenTarget);

  // 2. Kalkulasi ETA dan Metric lainnya menggunakan module Calculator
  const metrics = ChargingCalculator.calculateMetrics({
    currentPowerConsumption: currentWattage,
    batteryCapacity: batCapacityKwh,
    chargingEfficiency: session.efisiensiCharger,
    electricityCostPerKWh: tariff?.tariff || 0,
    persenAwal: session.persenAwal,
    persenTarget: session.persenTarget,
    persenRealtime: currentPercent,
    isCharging: session.status === 'ACTIVE' && currentWattage > 0,
    calibration: vehicle ? {
      usableBatteryKWh: vehicle.calibrationUsableBatteryKWh || batCapacityKwh,
      wallEnergyFullKWh: vehicle.calibrationWallEnergyFullKWh || (batCapacityKwh / session.efisiensiCharger),
      fullChargeHours: vehicle.calibrationFullChargeHours || 0,
      taperStartPercent: vehicle.calibrationTaperStartPercent || 80.0
    } : null
  });

  return c.json({
    ...metrics,
    status: session.status,
    accumulatedEnergy: session.accumulatedEnergy,
    cost: session.cost
  });
});

sessionsRoutes.post('/start', async (c) => {
  const db = getDb(c.env);
  const data = await c.req.json();

  data.startTime = Date.now();
  data.status = 'ACTIVE';
  data.accumulatedEnergy = 0;
  data.lastFetchTime = Date.now();

  const result = await db.insert(chargingSessions).values(data).returning();
  return c.json(result[0]);
});

sessionsRoutes.post('/stop/:id', async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));

  const now = Date.now();
  await db.update(chargingSessions)
    .set({
      status: 'STOPPED_MANUAL',
      endTime: now,
      lastFetchTime: now
    })
    .where(eq(chargingSessions.id, id));

  return c.json({ success: true });
});

export { sessionsRoutes };