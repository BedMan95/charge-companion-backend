import { Hono } from 'hono';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';

const authRoutes = new Hono<{ Bindings: { DB: D1Database, API_TOKEN: string } }>();

authRoutes.post('/login', async (c) => {
  const db = getDb(c.env);
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await db.select().from(users).where(eq(users.email, email)).get();

  // NOTE: Password should be hashed in production using crypto.subtle
  if (!user || user.password !== password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate JWT Token
  const secret = c.env.API_TOKEN || 'default_dev_token';
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const token = await sign(payload, secret);

  return c.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
});

authRoutes.post('/fcm-token', async (c) => {
  const db = getDb(c.env);
  const { userId, fcmToken } = await c.req.json();

  if (!userId || !fcmToken) {
    return c.json({ error: 'userId and fcmToken are required' }, 400);
  }

  await db.update(users)
    .set({ fcmToken })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

export { authRoutes };