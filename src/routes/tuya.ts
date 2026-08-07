import { Hono } from 'hono';
import { getDb } from '../db/client';
import { tuyaCredentials } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getTuyaAccessToken, sendTuyaCommand, getDeviceStatus, generateSignature } from '../services/tuya';

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

tuyaRoutes.get('/status/:userId', async (c) => {
  const db = getDb(c.env);
  const userId = c.req.param('userId');

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

    // Using the same method from Next.js (ambilStatusDevice) which gets all DPs
    const t = Date.now().toString();
    const path = `/v1.0/iot-03/devices/${creds.deviceId}/status`;

    // We can't reuse getDeviceStatus from services/tuya.ts because it only returns cur_power / 10
    // So we fetch manually here to return full array of status just like Next.js did
    // First, let's import generateSignature at the top of the file
    // Wait, it is not exported/imported. Let me import it.

    // To make it easy, I will just call generateSignature that I will import
    const { sign } = await generateSignature(
      creds.clientId,
      creds.clientSecret,
      'GET',
      path,
      {},
      '',
      t,
      '',
      accessToken
    );

    const response = await fetch(`${creds.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'client_id': creds.clientId,
        'access_token': accessToken,
        'sign': sign,
        't': t,
        'sign_method': 'HMAC-SHA256'
      }
    });

    const data = await response.json() as any;

    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export { tuyaRoutes };