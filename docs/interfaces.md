# TypeScript Interfaces

You can infer these interfaces directly from the Drizzle ORM schema, but here they are explicitly for frontend consumption (e.g. Next.js / Flutter model classes).

```typescript
// 1. Users & Auth
export interface User {
  id: string;
  name: string | null;
  email: string;
  password?: string | null;
  emailVerified: Date | null;
  image: string | null;
  fcmToken: string | null;
  createdAt: Date;
}

// 2. Credentials & Tariffs
export interface TuyaCredentials {
  userId: string;
  clientId: string;
  clientSecret: string;
  deviceId: string;
  baseUrl: string;
  autoCutoffThresholdWatt: number; // default: 5.0
}

export interface PlnTariff {
  userId: string;
  tariff: number;
}

// 3. EV Models & Vehicles
export interface EvModel {
  id: string;
  brand: string;
  model: string;
  batteryVolt: number;
  batteryAh: number;
  efisiensiCharger: number;
  imageUrl: string | null;
}

export interface UserVehicle {
  id: string;
  userId: string;
  evModelId: string;
  name: string | null;
  imageUrl: string | null;
  isActive: boolean; // default: false
  
  // Custom calibration/overrides
  calibrationUsableBatteryKWh: number | null;
  calibrationWallEnergyFullKWh: number | null;
  calibrationFullChargeHours: number | null;
  calibrationTaperStartPercent: number | null;
  
  customBatteryVolt: number | null;
  customBatteryAh: number | null;
  customEfisiensiCharger: number | null;
}

// 4. Charging Sessions
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'AUTO_CUTOFF' | 'STOPPED_MANUAL';

export interface ChargingSession {
  id: number; // auto-increment
  userId: string;
  vehicleId: string | null;
  
  startTime: Date | number; // stored as timestamp_ms
  endTime: Date | number | null;
  
  persenAwal: number;
  persenTarget: number;
  
  // Snapshot of specs at the time of charging
  batteryVolt: number; // default: 72
  batteryAh: number; // default: 38
  efisiensiCharger: number; // default: 0.82
  
  accumulatedEnergy: number; // in Watt-hours or kWh (default: 0)
  lastFetchTime: Date | number | null;
  
  status: SessionStatus; // default: 'ACTIVE'
  cutoffWattage: number | null;
}
```