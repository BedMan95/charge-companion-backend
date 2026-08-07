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
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
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
  accumulatedEnergy: real('accumulated_energy').notNull().default(0), // dalam Wh
  lastFetchTime: integer('last_fetch_time'),
  lowPowerCount: integer('low_power_count').notNull().default(0),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE', 'COMPLETED', 'AUTO_CUTOFF', 'STOPPED_MANUAL'
  cutoffWattage: real('cutoff_wattage'),
  cost: real('cost').notNull().default(0), // Biaya dalam Rupiah
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