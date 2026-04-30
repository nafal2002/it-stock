# Dokumentasi Teknis - IT Asset Keeper

Dokumen ini menjelaskan arsitektur sistem, struktur database, dan alur kerja fitur-fitur baru yang diimplementasikan.

## Sistem Autentikasi
Sistem menggunakan login terpusat dengan kredensial yang divalidasi.
- **Username**: nafal
- **Password**: nafal123
- **Bypass**: Fitur pendaftaran (SignUp) telah dihapus untuk meningkatkan keamanan akses internal.

## Arsitektur Sistem

Aplikasi ini menggunakan pola **Single Page Application (SPA)** dengan rendering sisi klien, yang dioptimalkan untuk deployment di **Cloudflare Pages**.
*   **Routing**: TanStack Router untuk navigasi yang type-safe.
*   **Data Fetching**: TanStack Query untuk caching dan sinkronisasi status server.
*   **Deployment**: Cloudflare Pages (Dashboard-configured).
*   **Real-time**: Supabase Postgres Changes untuk pembaruan UI instan.
*   **Storage**: Supabase Storage untuk gambar produk.

## Panduan Konfigurasi Cloudflare

Penting: Gunakan konfigurasi langsung via Dashboard Cloudflare Pages untuk menghindari konflik validasi file `wrangler.toml`.

### 1. Build Settings
- **Framework preset**: `None`
- **Build command**: `npm run build`
- **Build output directory**: `.output/public`

### 2. Environment Variables
Wajib dikonfigurasi di menu **Settings > Variables and Secrets**:
- `VITE_SUPABASE_URL`: URL API Supabase (Client-side)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Anon Key Supabase (Client-side)
- `SUPABASE_URL`: URL API Supabase (Server-side)
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (Server-side)

### 3. Compatibility Flags
Wajib diaktifkan di menu **Settings > Functions**:
- `nodejs_compat`: Untuk mendukung dependensi berbasis Node.js di Edge Runtime.

## Struktur Database
... (sisanya tetap sama)

### 1. Tabel `categories`
Menyimpan kategori barang secara dinamis dengan dukungan soft delete.
- `id`: UUID (PK)
- `nama_kategori`: TEXT
- `deskripsi`: TEXT
- `deleted_at`: TIMESTAMP (Soft delete marker)

### 2. Tabel `items`
Aset utama sistem.
- `category_id`: FK ke `categories.id` (Relasi Eager Loading)

### 3. Tabel `audit_logs`
Mencatat aktivitas penting: `created`, `updated`, `deleted`, `category_created`, `category_updated`, `category_deleted`, `transaction`.

## Optimasi Performa
1. **Indexing**: Index ditambahkan pada `user_id`, `kode`, `category_id`, dan `created_at`.
2. **Eager Loading**: Menggunakan `.select("*, categories(nama_kategori)")` untuk mengurangi jumlah query (N+1 problem).
3. **Caching**: TanStack Query mengelola cache data secara cerdas.
4. **Pagination**: Implementasi pagination pada modul Inventory dan Kategori.
