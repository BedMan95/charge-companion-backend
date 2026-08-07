# Charger Companion API Documentation

Base URL: `/api`

Semua endpoint kecuali `/auth/login` membutuhkan header `Authorization: Bearer <token>`.

## Authentication

### User Login
Digunakan untuk mendapatkan JWT Bearer Token.

- **URL:** `/auth/login`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin-123",
      "name": "Admin User",
      "email": "admin@example.com"
    }
  }
  ```

### Update FCM Token
Updates the FCM token for push notifications.

- **URL:** `/auth/fcm-token`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "userId": "string",
    "fcmToken": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": true
  }
  ```

## Credentials & Tariffs

### Get Tuya Credentials
- **URL:** `/credentials/tuya/:userId`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "userId": "string",
    "clientId": "string",
    "clientSecret": "string",
    "deviceId": "string",
    "baseUrl": "string",
    "autoCutoffThresholdWatt": 5.0
  }
  ```

### Save/Update Tuya Credentials
- **URL:** `/credentials/tuya`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "userId": "string",
    "clientId": "string",
    "clientSecret": "string",
    "deviceId": "string",
    "baseUrl": "string",
    "autoCutoffThresholdWatt": 5.0
  }
  ```
- **Response:** `{ "success": true }`

### Get PLN Tariff
- **URL:** `/credentials/tariff/:userId`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "userId": "string",
    "tariff": 1444.7
  }
  ```

### Save/Update PLN Tariff
- **URL:** `/credentials/tariff`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "userId": "string",
    "tariff": 1444.7
  }
  ```
- **Response:** `{ "success": true }`


## EV Models & Vehicles

### Get All Built-in EV Models
- **URL:** `/vehicles/models`
- **Method:** `GET`
- **Response:** Array of EV Models.

### Add EV Model
- **URL:** `/vehicles/models`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Form Data Fields:**
  - `id` (string)
  - `brand` (string)
  - `model` (string)
  - `batteryVolt` (number)
  - `batteryAh` (number)
  - `efisiensiCharger` (number)
  - `image` (file, opsional) - File gambar yang akan diupload ke Cloudflare R2
- **Response:** `{ "success": true, "imageUrl": "/api/images/models/..." }`

### Get User Vehicles
- **URL:** `/vehicles/user/:userId`
- **Method:** `GET`
- **Response:** Array of User Vehicles.

### Add User Vehicle
- **URL:** `/vehicles/user`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Form Data Fields:**
  - `id` (string)
  - `userId` (string)
  - `evModelId` (string)
  - `name` (string)
  - `isActive` (boolean, 'true' atau 'false')
  - `image` (file, opsional) - File gambar yang akan diupload ke Cloudflare R2
- **Response:** `{ "success": true, "imageUrl": "/api/images/user-vehicles/..." }`

### Update User Vehicle
- **URL:** `/vehicles/user/:id`
- **Method:** `PUT`
- **Content-Type:** `multipart/form-data`
- **Form Data Fields (Semua opsional):**
  - `name` (string)
  - `isActive` (boolean, 'true' atau 'false')
  - `customBatteryVolt` (number)
  - `customBatteryAh` (number)
  - `image` (file, opsional) - File gambar yang akan diupload ke Cloudflare R2
- **Response:** `{ "success": true, "imageUrl": "/api/images/user-vehicles/..." }`

### Delete User Vehicle
- **URL:** `/vehicles/user/:id`
- **Method:** `DELETE`
- **Response:** `{ "success": true }`


### Manual Tuya Switch Control
Digunakan untuk menghidupkan, mematikan, atau mengatur timer (countdown) smart plug secara manual (sama seperti fungsi Next.js lama).

- **URL:** `/tuya/control`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "userId": "string",
    "action": "on", // "on" atau "off"
    "delay": 0      // opsional, dalam hitungan detik. cth: 3600 (1 jam)
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": { ...response dari tuya... }
  }
  ```

## Charging Sessions

### Get Charging History
- **URL:** `/sessions/history/:userId?limit=10&offset=0`
- **Method:** `GET`
- **Response:** Array of charging sessions ordered by `startTime` desc.

### Start Charging Session
Starts a new charging session.
- **URL:** `/sessions/start`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "userId": "string",
    "vehicleId": "string",
    "persenAwal": 20,
    "persenTarget": 100,
    "batteryVolt": 72,
    "batteryAh": 38,
    "efisiensiCharger": 0.82
  }
  ```
- **Response:** The newly created session object (status will be `ACTIVE`).

### Stop Charging Session Manually
- **URL:** `/sessions/stop/:id`
- **Method:** `POST`
- **Response:** `{ "success": true }` (status changes to `STOPPED_MANUAL`).