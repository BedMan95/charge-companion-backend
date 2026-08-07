Kamu adalah Senior Cloud Engineer & Full-Stack Developer. Tolong bantu saya mengimplementasikan backend terpusat untuk proyek "Charger Companion" menggunakan Cloudflare Workers, Cloudflare D1, Hono.js, Drizzle ORM, dan TypeScript.

Sebelumnya saya punya aplikasi: 
- web D:\Project\Python\tuya-api\charge-companion
- flutter D:\Project\Android\chargecompanion
dua aplikasi memiliki konsep yang sama tapi implementasinya sedikit berbeda, saya ingin menggabungkannya, sehingga satu backend dapat digunakan untuk aplikasi/frontend lain. Dua app ini nantinya akan saya modifikasi untuk mengkonsumsi data dari backend. 

### 🎯 Tujuan Utama Backend
Membangun backend serverless 24/7 di Cloudflare Worker yang:
1. Menyediakan REST API untuk Flutter Mobile App & OpenNext.js Web Dashboard.
2. Menjalankan Cron Trigger setiap 1 menit untuk memeriksa status daya (Wattage) dari sesi cas yang sedang berjalan (`status = 'ACTIVE'`).
3. Mengisi/memperbarui data riwayat `charging_sessions` secara otomatis.
4. Melakukan Auto Cut-Off (`switch_1: false`) via Tuya OpenAPI jika daya Watt drop di bawah `auto_cutoff_threshold_watt`.
5. Mengirim Push Notification FCM HTTP v1 ke HP pengguna ketika cut-off berhasil dieksekusi.

---

### 🛠️ Stack Teknologi & Constraint System
- Runtime: Cloudflare Workers (TypeScript environment)
- Web Framework: Hono (`hono`)
- Database & ORM: Cloudflare D1 + Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- Crypto & Auth: Web Crypto API native (`crypto.subtle`) tanpa library external Node.js.
- Notification: FCM HTTP v1 REST API (Google OAuth2 via Service Account RSA-SHA256 JWT signing native).
- Config & Deployment: `wrangler.toml`

---

### 📂 Struktur Proyek yang Diharapkan
tuya-charger-companion-backend/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── schema.sql
└── src/
    ├── index.ts              # Entry point Worker (Hono REST API & Scheduled Cron)
    ├── db/
    │   ├── schema.ts         # Schema Drizzle ORM (Unified)
    │   └── client.ts         # Inisialisasi D1 Client
    ├── services/
    │   ├── tuya.ts           # Tuya OpenAPI client (HMAC-SHA256 & Token handling)
    │   └── fcm.ts            # FCM HTTP v1 Push Notification via Web Crypto RSA
    └── routes/
        ├── auth.ts           # Login/Register & Update FCM Token
        ├── credentials.ts    # CRUD Tuya Credentials & PLN Tariff
        ├── vehicles.ts       # CRUD EV Models & User Vehicles (inc. Custom Overrides)
        └── sessions.ts       # Start, Stop, & Get Charging Sessions

---

### 🗄️ Skema Database Drizzle ORM Terbaru (`src/db/schema.ts`)

Tolong buatkan berkas `src/db/schema.ts` persis dengan definisi Drizzle ORM berikut:

```typescript
import { sqliteTable, text, integer, primaryKey, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 1. AUTHENTICATION & USERS
export const users = sqliteTable('users', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password'),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  fcmToken: text('fcm_token'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => Date.now()),
});

export const accounts = sqliteTable('accounts', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compositePk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = sqliteTable('sessions', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationTokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

// 2. CREDENTIALS & TARIFFS
export const tuyaCredentials = sqliteTable('tuya_credentials', {
  userId: text('userId').notNull().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  deviceId: text('device_id').notNull(),
  baseUrl: text('base_url').notNull(),
  autoCutoffThresholdWatt: real('auto_cutoff_threshold_watt').notNull().default(5.0),
});

export const plnTariffs = sqliteTable('pln_tariffs', {
  userId: text('userId').notNull().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  tariff: real('tariff').notNull(),
});

// 3. EV MODELS & VEHICLES
export const evModels = sqliteTable('ev_models', {
  id: text('id').notNull().primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  batteryVolt: integer('battery_volt').notNull(),
  batteryAh: integer('battery_ah').notNull(),
  efisiensiCharger: real('efisiensi_charger').notNull(),
  imageUrl: text('image_url'),
});

export const userVehicles = sqliteTable('user_vehicles', {
  id: text('id').notNull().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  evModelId: text('ev_model_id').notNull().references(() => evModels.id),
  name: text('name'),
  imageUrl: text('image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  calibrationUsableBatteryKWh: real('calibration_usable_battery_kwh'),
  calibrationWallEnergyFullKWh: real('calibration_wall_energy_full_kwh'),
  calibrationFullChargeHours: real('calibration_full_charge_hours'),
  calibrationTaperStartPercent: real('calibration_taper_start_percent'),
  customBatteryVolt: real('custom_battery_volt'),
  customBatteryAh: real('custom_battery_ah'),
  customEfisiensiCharger: real('custom_efisiensi_charger'),
});

// 4. CHARGING SESSIONS
export const chargingSessions = sqliteTable('charging_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').references(() => userVehicles.id, { onDelete: 'set null' }),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time'),
  persenAwal: integer('persen_awal').notNull(),
  persenTarget: integer('persen_target').notNull(),
  batteryVolt: integer('battery_volt').notNull().default(72),
  batteryAh: integer('battery_ah').notNull().default(38),
  efisiensiCharger: real('efisiensi_charger').notNull().default(0.82),
  accumulatedEnergy: real('accumulated_energy').notNull().default(0),
  lastFetchTime: integer('last_fetch_time'),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE', 'COMPLETED', 'AUTO_CUTOFF', 'STOPPED_MANUAL'
  cutoffWattage: real('cutoff_wattage'),
});

// RELATIONS
export const userVehiclesRelations = relations(userVehicles, ({ one }) => ({
  evModel: one(evModels, { fields: [userVehicles.evModelId], references: [evModels.id] }),
  user: one(users, { fields: [userVehicles.userId], references: [users.id] }),
}));

export const chargingSessionsRelations = relations(chargingSessions, ({ one }) => ({
  user: one(users, { fields: [chargingSessions.userId], references: [users.id] }),
  vehicle: one(userVehicles, { fields: [chargingSessions.vehicleId], references: [userVehicles.id] }),
}));
⚙️ Instruksi Implementasi Modul Demi Modul
Step 1: Config & Setup
Buat package.json dengan dependency: hono, drizzle-orm, @cloudflare/workers-types, drizzle-kit, wrangler.

Buat wrangler.toml dengan D1 database binding (DB), triggers = { crons = ["* * * * *"] }, dan environment variables.

Buat schema.sql berbasis D1 SQL Native.

Step 2: Tuya OpenAPI Client (src/services/tuya.ts)
Implementasikan kalkulasi Tuya HMAC-SHA256 Signature murni dengan Web Crypto API (crypto.subtle).

Fungsi getTuyaAccessToken(env, credentials) untuk mengambil token Tuya API.

Fungsi getDeviceStatus(env, credentials) untuk membaca daya konsumsi saat ini (cur_power dalam desimal Watt).

Fungsi turnOffDevice(env, credentials) untuk mematikan saklar smart plug (switch_1: false).

Step 3: FCM Push Notification Client (src/services/fcm.ts)
Implementasikan pembuatan Google OAuth2 Access Token menggunakan Web Crypto API untuk membuat JWT assertion bertipe RS256 dari FIREBASE_SERVICE_ACCOUNT JSON string.

Fungsi sendFcmNotification(env, fcmToken, title, body) yang memanggil FCM HTTP v1 REST API (https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send).

Step 4: Scheduled Cron Execution Handler (src/index.ts)
Di handler scheduled(event, env, ctx):

Cari semua data chargingSessions yang berstatus 'ACTIVE'.

Join dengan tuyaCredentials dan users untuk mendapatkan kredensial Tuya dan FCM Token pengguna.

Untuk setiap sesi aktif:

Ambil Wattage terkini via getDeviceStatus().

Hitung dan update accumulatedEnergy serta lastFetchTime.

Jika currentWattage <= autoCutoffThresholdWatt:

Panggil turnOffDevice().

Update status sesi di DB menjadi 'AUTO_CUTOFF', isi endTime = Date.now(), dan cutoffWattage = currentWattage.

Jika fcmToken tersedia, kirim notifikasi: "Pengisian Selesai! Charger otomatis dimatikan pada daya " + currentWattage + " W.".

Step 5: Hono REST API Routes
/api/fcm-token (POST): Mengupdate FCM token milik user yang login.

/api/credentials/tuya (GET, POST, PUT): Kelola kredensial Tuya & threshold Watt.

/api/vehicles (GET, POST, PUT, DELETE): Manajemen kendaraan pengguna (termasuk custom specs).

/api/sessions (GET, POST, PUT): Memulai sesi cas baru (ACTIVE), mematikan manual (STOPPED_MANUAL), dan mengambil riwayat sesi.

### Tambahan Implementasi
- **Autentikasi (JWT Bearer Token):**
  Menggunakan `hono/jwt` dengan rute `/api/auth/login`. Semua rute API dilindungi dengan middleware JWT (kecuali rute login dan Swagger UI). Token default untuk development dapat disetel di `.dev.vars` / `wrangler.toml` dengan kunci `API_TOKEN`.
- **Upload Gambar (Cloudflare R2):**
  Rute manajemen kendaraan (`POST /api/vehicles/models`, `POST /api/vehicles/user`, `PUT /api/vehicles/user/:id`) menggunakan `multipart/form-data` dan otomatis menyimpan file gambar ke Cloudflare R2 bucket `charger-companion-images`.
- **Dokumentasi API:**
  - Swagger UI dapat diakses secara publik di `/ui`.
  - Spesifikasi Markdown `docs/api.md` untuk pedoman frontend/mobile.
  - Spesifikasi interface TypeScript di `docs/interfaces.md`.

Tolong mulai dengan menulis file konfigurasi (package.json, wrangler.toml, schema.sql, drizzle.config.ts), lalu selesaikan modul TypeScript satu per satu hingga tidak ada TypeScript/Linter error.