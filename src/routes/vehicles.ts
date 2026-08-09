import { Hono } from 'hono';
import { getDb } from '../db/client';
import { evModels, userVehicles } from '../db/schema';
import { eq } from 'drizzle-orm';

// Tambahkan tipe BUCKET untuk Cloudflare R2
const vehiclesRoutes = new Hono<{ Bindings: { DB: D1Database, KV: KVNamespace } }>();

vehiclesRoutes.get('/models', async (c) => {
  const db = getDb(c.env);
  const models = await db.select().from(evModels);
  return c.json(models);
});

// Update route ini untuk mendukung multipart/form-data (upload gambar)
vehiclesRoutes.post('/models', async (c) => {
  const db = getDb(c.env);

  // Ambil body sebagai form data
  const formData = await c.req.formData();

  const id = formData.get('id') as string;
  const brand = formData.get('brand') as string;
  const model = formData.get('model') as string;
  const batteryVolt = Number(formData.get('batteryVolt'));
  const batteryAh = Number(formData.get('batteryAh'));
  const efisiensiCharger = Number(formData.get('efisiensiCharger'));

  // Tangani file gambar (opsional)
  const image = formData.get('image') as File | null;
  let imageUrl: string | null = null;

  if (image && image.size > 0) {
    const fileExtension = image.name.split('.').pop();
    const fileName = `models/${id}-${Date.now()}.${fileExtension}`;

    // Simpan ke R2 Bucket
    await c.env.KV.put(fileName, await image.arrayBuffer(), {
      metadata: { contentType: image.type }
    });

    // Asumsi public URL bucket (Bisa disesuaikan dengan domain R2 public Anda)
    imageUrl = `/api/images/${fileName}`;
  }

  const data = {
    id, brand, model, batteryVolt, batteryAh, efisiensiCharger, imageUrl
  };

  await db.insert(evModels).values(data);
  return c.json({ success: true, imageUrl });
});

vehiclesRoutes.get('/user/:userId', async (c) => {
  const db = getDb(c.env);
  const userId = c.req.param('userId');
  const vehicles = await db.select().from(userVehicles).where(eq(userVehicles.userId, userId));
  return c.json(vehicles);
});

// Update Add User Vehicle mendukung upload gambar (multipart)
vehiclesRoutes.post('/user', async (c) => {
  const db = getDb(c.env);
  const formData = await c.req.formData();

  const id = formData.get('id') as string;
  const userId = formData.get('userId') as string;
  const evModelId = formData.get('evModelId') as string;
  const name = formData.get('name') as string;
  const isActive = formData.get('isActive') === 'true';

  const image = formData.get('image') as File | null;
  let imageUrl: string | null = null;

  if (image && image.size > 0) {
    const fileExtension = image.name.split('.').pop();
    const fileName = `user-vehicles/${id}-${Date.now()}.${fileExtension}`;

    await c.env.KV.put(fileName, await image.arrayBuffer(), {
      metadata: { contentType: image.type }
    });

    imageUrl = `/api/images/${fileName}`;
  }

  const data = {
    id, userId, evModelId, name, isActive, imageUrl
  };

  await db.insert(userVehicles).values(data);
  return c.json({ success: true, imageUrl });
});

// Update edit user vehicle (multipart)
vehiclesRoutes.put('/user/:id', async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  const formData = await c.req.formData();

  const data: any = {};

  if (formData.has('name')) data.name = formData.get('name') as string;
  if (formData.has('isActive')) data.isActive = formData.get('isActive') === 'true';

  // Custom specs overrides
  if (formData.has('customBatteryVolt')) data.customBatteryVolt = Number(formData.get('customBatteryVolt'));
  if (formData.has('customBatteryAh')) data.customBatteryAh = Number(formData.get('customBatteryAh'));

  const image = formData.get('image') as File | null;
  if (image && image.size > 0) {
    const fileExtension = image.name.split('.').pop();
    const fileName = `user-vehicles/${id}-${Date.now()}.${fileExtension}`;

    await c.env.KV.put(fileName, await image.arrayBuffer(), {
      metadata: { contentType: image.type }
    });

    data.imageUrl = `/api/images/${fileName}`;
  }

  await db.update(userVehicles).set(data).where(eq(userVehicles.id, id));
  return c.json({ success: true, imageUrl: data.imageUrl });
});

vehiclesRoutes.delete('/user/:id', async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  await db.delete(userVehicles).where(eq(userVehicles.id, id));
  return c.json({ success: true });
});

export { vehiclesRoutes };