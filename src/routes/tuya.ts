import { Hono } from 'hono';
import { getDb } from '../db/client';
import { tuyaCredentials } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getTuyaAccessToken, sendTuyaCommand } from '../services/tuya';

const tuyaRoutes = new Hono<{ Bindings: { DB: D1Database } }>();

tuyaRoutes.post('/control', async (c) => {
  const db = getDb(c.env);
  const { userId, action, delay = 0 } = await c.req.json();

  if (!userId || !action) {
    return c.json({ success: false, error: 'userId and action are required' }, 400);
  }

  const creds = await db.select().from(tuyaCredentials).where(eq(tuyaCredentials.userId, userId)).get();

  if (!creds) {
    return c.json({ success: false, error: 'Tuya credentials not found for this user' }, 404);
  }

  try {
    const accessToken = await getTuyaAccessToken(
      creds.clientId,
      creds.clientSecret,
      creds.baseUrl
    );

    const commands: any[] = [];

    // Tuya countdown DP is countdown_1 (value in seconds, 0-86400)
    if (delay > 0) {
      commands.push({ code: 'countdown_1', value: delay });
    } else {
      commands.push({ code: 'switch_1', value: action === 'on' });
    }

    const result = await sendTuyaCommand(
      creds.clientId,
      creds.clientSecret,
      creds.baseUrl,
      creds.deviceId,
      accessToken,
      commands
    );

    return c.json({ success: true, data: result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export { tuyaRoutes };