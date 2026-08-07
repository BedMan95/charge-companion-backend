# Charger Companion Backend ⚡

Backend terpusat serverless yang dibangun di atas Cloudflare Workers, melayani aplikasi **Flutter (Android)** dan **Next.js (Web)** untuk proyek *Tuya Charger Companion*.

## 🎯 Fitur Utama
- 🚀 **Serverless 24/7:** Berjalan di Cloudflare Workers.
- 🕒 **Cron Trigger Terintegrasi:** Mengecek daya Watt dari Smart Plug secara otomatis (setiap menit) dan mematikan charger saat baterai penuh.
- ⚡ **Kalkulasi Presisi (SLA Tapering):** Perhitungan ETA, Numerical Integration Charge Tapering, Biaya Rupiah, & Efisiensi Daya murni dihitung oleh Backend. Frontend cukup polling endpoint `/sessions/metrics` untuk update UI.
- 🔐 **JWT Bearer Auth & R2 Storage:** Melindungi API dan mengelola upload gambar kendaraan.
- 🔔 **FCM Push Notification:** Kirim notifikasi seketika daya berhasil diputus (Cut-Off).
- 🎮 **Manual Tuya Control:** Mengatur hidup, mati, atau timer smart plug langsung via REST API (porting penuh dari API Next.js).

## 🧑‍💻 Panduan Polling untuk Frontend (Flutter/Next.js)
Karena backend ini Serverless dan *REST-based*, untuk mengupdate UI (ETA, baterai realtime) gunakan strategi Polling:
1. Pasang Timer/Interval (contoh setiap 10 detik) yang berjalan **hanya saat aplikasi/dashboard terbuka**.
2. Tarik daya Watt perangkat Tuya dari endpoint `GET /api/tuya/status/:userId`.
3. Kirim Watt tersebut ke backend `GET /api/sessions/metrics/:id?watt=<hasil_watt>`.
4. Render *response JSON* dari backend ke layar (UI).
5. Ketika user menutup aplikasi, Cron di backend otomatis akan terus mengecek dan mengurus *cut-off* secara mandiri, jadi UI aman dimatikan.

## 🛠️ Stack Teknologi
- **Runtime:** Cloudflare Workers (TypeScript)
- **Web Framework:** Hono.js
- **Database & ORM:** Cloudflare D1 (SQLite) + Drizzle ORM
- **Authentication:** JWT via `hono/jwt`
- **Storage:** Cloudflare R2 Bucket
- **API Spec:** Swagger UI + OpenAPI 3.0

## 📂 Struktur Proyek
- `src/index.ts` : Entry Point (Cron Worker & Hono App)
- `src/db/` : Schema Drizzle & Koneksi Database
- `src/routes/` : Kumpulan Endpoint REST API (Auth, Kendaraan, Session, Tuya, Kredensial)
- `src/services/` : Integrasi eksternal (Tuya OpenAPI & FCM HTTP v1)
- `src/utils/` : Kalkulator matematis ETA & Biaya (Charging Metrics)
- `docs/` : API & Interface Documentations

## 🚀 Instalasi & Menjalankan Lokal

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Buat File `.dev.vars`:**
   Buat file `.dev.vars` di root folder dan isi dengan rahasia environment:
   ```env
   API_TOKEN=rahasia_token_dev_anda
   ```
3. **Inisialisasi Database Lokal:**
   ```bash
   npx wrangler d1 execute charger_companion --local --file=./schema.sql
   ```
   *(Opsional: Anda bisa menggunakan `seed.sql` untuk membuat user admin awal).*
4. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```

Akses dokumentasi interaktif Swagger UI di: `http://localhost:8787/ui`

## 📚 Dokumentasi
Silakan rujuk ke folder `docs/` untuk memahami format request/response (JSON) dan interface struktur data TypeScript.
