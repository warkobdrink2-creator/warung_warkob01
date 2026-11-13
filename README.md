# ANTRIAN WARUNG

Aplikasi web modern untuk mengelola **antrean pelanggan, kasir POS, layar dapur (KDS), monitor display TV, pembayaran & struk digital, inventory stok, serta laporan penjualan** secara realtime.

## Fitur Utama

- **4 Peran Pengguna (RBAC)**: Admin, Kasir, Dapur, dan Pelanggan dengan proteksi route & session.
- **Sistem Nomor Antrean Atomik**: Nomor otomatis harian (`A001`, `A002`, ...) dengan reset harian & pencegahan duplikasi/race condition.
- **Realtime Multi-Perangkat**: Pembaruan langsung antar Pelanggan, Kasir, Dapur, dan Layar Display TV (`/display`) melalui WebSocket / Supabase Realtime.
- **Panggil Antrean Bersuara**: Integrasi Web Speech API Bahasa Indonesia (*"Nomor antrean A023, silakan menuju kasir."*).
- **Kasir POS & Modifier**: Keranjang pesanan, catatan per item, modifier tambahan (Telur, Keju, Sambal, Extra Saus, Extra Mie, Es, Level Pedas).
- **Pembayaran & Struk Digital**: Tunai (hitung kembalian otomatis), QRIS, Transfer, E-wallet, cetak struk thermal/PDF, dan bagikan.
- **Manajemen Stok & Peringatan**: Stok masuk/keluar/penyesuaian, peringatan *"Stok hampir habis"*, dan blokir otomatis untuk *"MENU HABIS"*.
- **Laporan & Export**: Filter tanggal (Hari Ini, Kemarin, Minggu Ini, Bulan Ini, Custom), ranking menu terlaris, laba kotor, serta export CSV & Print/PDF.
- **PWA & Mode Offline**: Dapat di-install ke Android/Desktop, cache menu offline, antrean transaksi lokal (IndexedDB/LocalStorage), dan indikator status `Online` / `Offline` / `Sinkronisasi`.

---

## Panduan Instalasi & Deployment

### 1. Install Dependency

```bash
npm install
```

### 2. Konfigurasi Supabase (Opsional untuk Mode Cloud PostgreSQL)

Aplikasi dapat berjalan langsung menggunakan server backend lokal + WebSocket bawaan untuk pengujian instan, maupun terhubung ke proyek **Supabase** produksi.

1. Buat project baru di [Supabase](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase.
3. Salin seluruh isi file `supabase/schema.sql` dan jalankan (**Run**).
4. Buat akun pengguna demo di **Authentication -> Users** lalu atur perannya pada tabel `public.profiles` (`admin`, `kasir`, `dapur`, `pelanggan`).

### 3. Isi Environment Variables

Salin `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi variabel berikut:

```env
VITE_SUPABASE_URL="https://project-id-anda.supabase.co"
VITE_SUPABASE_ANON_KEY="anon-public-key-anda"
APP_URL="http://localhost:3000"
```

> **Penting**: Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di frontend atau mem-push file `.env` ke GitHub.

### 4. Jalankan Development

```bash
npm run dev
```

Buka `http://localhost:3000`.

### 5. Build Production

```bash
npm run build
npm start
```

### 6. Push ke GitHub

```bash
git init
git add .
git commit -m "feat: antrian warung production ready"
git branch -M main
git remote add origin https://github.com/username/antrian-warung.git
git push -u origin main
```

### 7. Deploy ke Vercel

1. Login ke [Vercel](https://vercel.com) dan pilih **Add New Project**.
2. Hubungkan repository GitHub `antrian-warung`.
3. Tambahkan **Environment Variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Klik **Deploy** — Vercel akan menjalankan `npm run build` dan menerbitkan aplikasi Anda.
