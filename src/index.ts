import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { getDb } from './db/client';
import { eq } from 'drizzle-orm';
import { chargingSessions, tuyaCredentials, users, plnTariffs } from './db/schema';
import { getDeviceStatus, getTuyaAccessToken, turnOffDevice } from './services/tuya';
import { sendFcmNotification } from './services/fcm';

import { authRoutes } from './routes/auth';
import { credentialsRoutes } from './routes/credentials';
import { vehiclesRoutes } from './routes/vehicles';
import { sessionsRoutes } from './routes/sessions';
import { tuyaRoutes } from './routes/tuya';

type Bindings = {
  DB: D1Database;
  FIREBASE_SERVICE_ACCOUNT: string;
  API_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Swagger UI Route (No auth)
app.get('/ui', swaggerUI({ url: '/doc' }));
app.get('/doc', (c) => {
  return c.json({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Charger Companion API',
    },
    paths: {
      '/api/auth/login': {
        post: {
          summary: 'User Login',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { email: { type: 'string', example: 'admin@example.com' }, password: { type: 'string', example: 'password123' } } }
              }
            }
          },
          responses: { '200': { description: 'Returns JWT Token' } }
        }
      },
      '/api/auth/fcm-token': {
        post: {
          summary: 'Update FCM Token',
          requestBody: {
            content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', example: 'admin-123' }, fcmToken: { type: 'string', example: 'fcm-token-xyz-123' } } } } }
          },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/credentials/tuya/{userId}': {
        get: {
          summary: 'Get Tuya Credentials',
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', example: 'admin-123' } }],
          responses: { '200': { description: 'Credentials object' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/credentials/tuya': {
        post: {
          summary: 'Update Tuya Credentials',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', example: 'admin-123' }, clientId: { type: 'string', example: 'tuya-client-123' }, clientSecret: { type: 'string', example: 'tuya-secret-xyz' }, deviceId: { type: 'string', example: 'device-999' }, baseUrl: { type: 'string', example: 'https://openapi.tuyaeu.com' }, autoCutoffThresholdWatt: { type: 'number', example: 5.0 } } } } } },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/credentials/tariff/{userId}': {
        get: {
          summary: 'Get PLN Tariff',
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', example: 'admin-123' } }],
          responses: { '200': { description: 'Tariff object' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/credentials/tariff': {
        post: {
          summary: 'Update PLN Tariff',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', example: 'admin-123' }, tariff: { type: 'number', example: 1444.7 } } } } } },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/vehicles/models': {
        get: { summary: 'Get EV Models', responses: { '200': { description: 'Array of models' } }, security: [{ bearerAuth: [] }] },
        post: {
          summary: 'Add EV Model',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'm1' },
                    brand: { type: 'string', example: 'Uwinfly' },
                    model: { type: 'string', example: 'T3' },
                    batteryVolt: { type: 'integer', example: 72 },
                    batteryAh: { type: 'integer', example: 20 },
                    efisiensiCharger: { type: 'number', example: 0.85 },
                    image: { type: 'string', format: 'binary', description: 'Upload gambar kendaraan' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/vehicles/user/{userId}': {
        get: {
          summary: 'Get User Vehicles',
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', example: 'admin-123' } }],
          responses: { '200': { description: 'Array of user vehicles' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/vehicles/user': {
        post: {
          summary: 'Add User Vehicle',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'v1' },
                    userId: { type: 'string', example: 'admin-123' },
                    evModelId: { type: 'string', example: 'm1' },
                    name: { type: 'string', example: 'Motor Harian' },
                    isActive: { type: 'boolean', example: true },
                    image: { type: 'string', format: 'binary', description: 'Upload gambar kendaraan user' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/tuya/control': {
        post: {
          summary: 'Manual Tuya Switch Control',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', example: 'admin-123' }, action: { type: 'string', enum: ['on', 'off'], example: 'on' }, delay: { type: 'integer', example: 0 } } } } } },
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/sessions/history/{userId}': {
        get: {
          summary: 'Get Charging History',
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', example: 'admin-123' } }],
          responses: { '200': { description: 'Array of history' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/sessions/metrics/{id}': {
        get: {
          summary: 'Get Live Charging ETA & Metrics',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } },
            { name: 'watt', in: 'query', required: false, schema: { type: 'number', example: 550 }, description: 'Daya realtime dari smart plug (Watt)' }
          ],
          responses: { '200': { description: 'Live Metrics Data' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/sessions/start': {
        post: {
          summary: 'Start Charging Session',
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', example: 'admin-123' }, vehicleId: { type: 'string', example: 'v1' }, persenAwal: { type: 'integer', example: 20 }, persenTarget: { type: 'integer', example: 100 }, batteryVolt: { type: 'integer', example: 72 }, batteryAh: { type: 'integer', example: 20 }, efisiensiCharger: { type: 'number', example: 0.85 } } } } } },
          responses: { '200': { description: 'Session object' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/sessions/stop/{id}': {
        post: {
          summary: 'Stop Charging Session',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Success' } },
          security: [{ bearerAuth: [] }]
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  });
});

app.get('/', (c) => {
  return c.text('Tuya Charger Companion API is running!');
});

// Apply Bearer Auth (JWT) to all API routes EXCEPT login
import { jwt } from 'hono/jwt';

app.use('/api/*', async (c, next) => {
  // Skip auth for login route
  if (c.req.path === '/api/auth/login') {
    return next();
  }

  const token = c.env.API_TOKEN || 'default_dev_token';
  const authMiddleware = jwt({ secret: token, alg: 'HS256' });
  return authMiddleware(c as any, next);
});

app.route('/api/auth', authRoutes);
app.route('/api/credentials', credentialsRoutes);
app.route('/api/vehicles', vehiclesRoutes);
app.route('/api/sessions', sessionsRoutes);
app.route('/api/tuya', tuyaRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const db = getDb(env);

    const activeSessions = await db
      .select({
        session: chargingSessions,
        credentials: tuyaCredentials,
        user: users,
        tariff: plnTariffs
      })
      .from(chargingSessions)
      .innerJoin(tuyaCredentials, eq(chargingSessions.userId, tuyaCredentials.userId))
      .innerJoin(users, eq(chargingSessions.userId, users.id))
      .leftJoin(plnTariffs, eq(chargingSessions.userId, plnTariffs.userId))
      .where(eq(chargingSessions.status, 'ACTIVE'));

    for (const data of activeSessions) {
      try {
        const { session, credentials, user, tariff } = data;
        const accessToken = await getTuyaAccessToken(
          credentials.clientId,
          credentials.clientSecret,
          credentials.baseUrl
        );

        const currentWattage = await getDeviceStatus(
          credentials.clientId,
          credentials.clientSecret,
          credentials.baseUrl,
          credentials.deviceId,
          accessToken
        );

        const now = Date.now();
        let energyDeltaWh = 0; // dalam Watt-hours (Wh)

        if (session.lastFetchTime) {
          const hoursElapsed = (now - session.lastFetchTime) / (1000 * 60 * 60);
          energyDeltaWh = currentWattage * hoursElapsed;
        }

        const newAccumulatedEnergyWh = session.accumulatedEnergy + energyDeltaWh;

        // 1. Hitung Kapasitas Baterai (kWh)
        const batCapacityKwh = (session.batteryVolt * session.batteryAh) / 1000.0;

        // 2. Hitung Energi yang masuk ke baterai (DC)
        const energyDcChargedWh = newAccumulatedEnergyWh * session.efisiensiCharger;
        const energyDcChargedKwh = energyDcChargedWh / 1000.0;

        // 3. Hitung penambahan persentase
        const addedPercentage = (energyDcChargedKwh / batCapacityKwh) * 100;

        // 4. Hitung Persentase Realtime saat ini (dibatasi tidak lebih dari target)
        const currentPersen = Math.min(session.persenAwal + addedPercentage, session.persenTarget);

        // 5. Cek kondisi Daya Rendah (Trickle Charge)
        let lowPowerCount = session.lowPowerCount || 0;
        if (currentWattage > 0 && currentWattage < 50.0) {
          lowPowerCount++;
        } else {
          lowPowerCount = 0;
        }

        const isTrickleFinished = lowPowerCount >= 4;

        // 6. Hitung Biaya (Rp)
        // 1 kWh = tariff.tariff, accumulatedEnergyWh / 1000 = kWh
        let currentCost = 0;
        if (tariff) {
          const kwh = newAccumulatedEnergyWh / 1000.0;
          currentCost = kwh * tariff.tariff;
        }

        // 7. Evaluasi kondisi CUT-OFF
        // Cut-off jika: 1) Watt drop di bawah threshold ATAU 2) Target persentase tercapai DAN trickle selesai
        if (currentWattage <= credentials.autoCutoffThresholdWatt || (currentPersen >= session.persenTarget && isTrickleFinished)) {
          await turnOffDevice(
            credentials.clientId,
            credentials.clientSecret,
            credentials.baseUrl,
            credentials.deviceId,
            accessToken
          );

          await db.update(chargingSessions)
            .set({
              status: 'AUTO_CUTOFF',
              endTime: now,
              cutoffWattage: currentWattage,
              accumulatedEnergy: newAccumulatedEnergyWh,
              lastFetchTime: now,
              lowPowerCount: lowPowerCount,
              cost: currentCost
            })
            .where(eq(chargingSessions.id, session.id));

          if (user.fcmToken && env.FIREBASE_SERVICE_ACCOUNT) {
            await sendFcmNotification(
              env.FIREBASE_SERVICE_ACCOUNT,
              user.fcmToken,
              "Pengisian Selesai!",
              `Charger otomatis dimatikan. Baterai mencapai target ${currentPersen.toFixed(1)}%. Biaya: Rp ${currentCost.toFixed(0)}`
            );
          }
        } else {
          await db.update(chargingSessions)
            .set({
              accumulatedEnergy: newAccumulatedEnergyWh,
              lastFetchTime: now,
              lowPowerCount: lowPowerCount,
              cost: currentCost
            })
            .where(eq(chargingSessions.id, session.id));
        }
      } catch (e) {
        console.error('Error processing session:', e);
      }
    }
  }
};