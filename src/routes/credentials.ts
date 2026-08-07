import { Hono } from 'hono';
import { getDb } from '../db/client';
import { tuyaCredentials, plnTariffs } from '../db/schema';
import { eq } from 'drizzle-orm';

const credentialsRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

credentialsRoutes.get('/tuya/:userId', async (c) => {
  const db = getDb(c.env);
  const userId = c.req.param('userId');

  const creds = await db.select().from(tuyaCredentials).where(eq(tuyaCredentials.userId, userId)).get();
  return c.json(creds || null);
});

credentialsRoutes.post('/tuya', async (c) => {
  const db = getDb(c.env);
  const data = await c.req.json();

  await db.insert(tuyaCredentials).values(data).onConflictDoUpdate({
    target: tuyaCredentials.userId,
    set: data
  });

  return c.json({ success: true });
});

credentialsRoutes.get('/tariff/:userId', async (c) => {
  const db = getDb(c.env);
  const userId = c.req.param('userId');

  const tariff = await db.select().from(plnTariffs).where(eq(plnTariffs.userId, userId)).get();
  return c.json(tariff || null);
});

credentialsRoutes.post('/tariff', async (c) => {
  const db = getDb(c.env);
  const data = await c.req.json();

  await db.insert(plnTariffs).values(data).onConflictDoUpdate({
    target: plnTariffs.userId,
    set: data
  });

  return c.json({ success: true });
});

export { credentialsRoutes };