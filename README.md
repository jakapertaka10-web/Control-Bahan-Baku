# WMS Bahan Baku Mattress

Aplikasi Express untuk operasional bahan baku mattress. Pada konfigurasi normal, semua saldo persisten dibaca dan diubah di Supabase PostgreSQL. Backend memakai service-role key; browser hanya mengakses Express dan tidak pernah menerima key tersebut. `schema.sql` di root adalah skema SQLite legacy sebagai referensi sumber import saja; runtime tidak memakainya.

## Prasyarat

- Node.js 22 atau lebih baru.
- Project Supabase.
- Supabase CLI, dijalankan melalui `npx supabase`, untuk menerapkan migrations.

## Setup lokal baru

1. Install dependencies:

   ```powershell
   npm ci
   ```

2. Buat `.env` dari template:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Isi `.env` langsung di editor lokal dengan nilai dari Supabase Project Settings → API Keys:

   ```dotenv
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
   WMS_SESSION_SECRET=<random-secret-panjang>
   PORT=3000
   ```

   `SUPABASE_SERVICE_ROLE_KEY` adalah rahasia server. Jangan gunakan pada kode browser, HTML, `public/`, atau `VITE_*` variable, dan jangan commit `.env`.

4. Login dan tautkan Supabase CLI ke project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

5. Terapkan schema dan RPC PostgreSQL:

   ```powershell
   npm run db:push
   ```

6. Untuk migrasi data lokal satu kali, pastikan tabel project Supabase masih kosong. Importer berhenti jika menemukan data pada tabel target agar tidak menimpa data produksi. Jalankan dari folder project:

   ```powershell
   $env:SQLITE_DB_PATH = "C:\path\to\backup\wms.db"
   npm run db:import:sqlite
   ```

   Jika `SQLITE_DB_PATH` tidak diisi, importer membaca `wms.db` di folder project. Importer hanya membaca file SQLite; server aplikasi tidak membuka database SQLite.

7. Jalankan server:

   ```powershell
   npm start
   ```

   Buka `http://localhost:3000`.

## Demo lokal tanpa Supabase

Jika `DEMO_MODE=true`, atau `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` masih kosong atau berisi placeholder dari `.env.example`, server lokal menjalankan mode demo menggunakan data contoh di memori. Hapus atau nonaktifkan `DEMO_MODE` untuk kembali menggunakan Supabase.

- Login: `admin@example.com` / `admin123`
- Perubahan demo hilang ketika server dihentikan atau dimulai ulang.
- Mode demo hanya untuk uji coba lokal; aplikasi menolak berjalan dalam mode demo pada `NODE_ENV=production`.
- Untuk menyimpan data operasional, konfigurasi Supabase dan jalankan migration sesuai langkah setup di atas.

## Operasional transaksi

Barang masuk menulis receiving lebih dulu, lalu QC, karantina barang rejected, put-away, inventory, movement, dan audit dicatat dalam PostgreSQL. Stok hanya berubah saat konfirmasi put-away. Barang keluar, opname, dan adjustment menggunakan Postgres RPC yang mengunci row inventory; pengeluaran melebihi saldo ditolak di database. `available_qty` selalu sama dengan `physical_qty`.

Dashboard memperbarui data lintas perangkat lewat Supabase Realtime → endpoint SSE Express, dengan refresh berkala sebagai fallback. Tabel internal mengaktifkan RLS dan mencabut grants dari `anon` serta `authenticated`; akses dilakukan oleh backend server.

## Verifikasi lokal

```powershell
npm run db:verify
```

Perintah ini menjalankan migration dan smoke test transaksi di embedded PostgreSQL lokal. Tes tidak terhubung ke Supabase project.

## Backup database

- Project berbayar mendapat scheduled daily backups; akses/restore melalui Supabase Dashboard → Database → Backups. Retensi bergantung plan.
- Untuk backup logical manual, tautkan CLI ke project lalu jalankan:

  ```powershell
  npx supabase db dump --linked --file ..\wms-postgres-backup.sql
  ```

- Simpan backup di lokasi aman di luar repository. Jangan commit dump database yang berisi data operasional atau password hash.
- Untuk free plan, jadwalkan logical dump manual dan simpan salinan off-site. Pertimbangkan Point-in-Time Recovery jika target kehilangan data harus lebih rendah.

## Upload ke GitHub

Push atau upload semua isi folder project ke repository GitHub. Jangan sertakan `.env`, `wms.db`, atau `node_modules`; `.gitignore` mengecualikan file tersebut. `.env.example` berisi nama variable dan placeholder aman. GitHub Actions akan menjalankan syntax check dan test PostgreSQL embedded setiap push/pull request.

GitHub menyimpan source code, bukan menjalankan backend ini. **GitHub Pages tidak cocok** untuk aplikasi Express/Supabase ini. Untuk menjalankan aplikasi online, hubungkan repository ke hosting Node.js (misalnya Render atau Railway), gunakan Node.js 22+, install command `npm ci`, dan start command `npm start`. Tambahkan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `WMS_SESSION_SECRET` melalui secret/environment settings hosting; jangan taruh nilainya di GitHub files. Tidak ada SQLite file atau volume lokal yang diperlukan setelah migrasi.
