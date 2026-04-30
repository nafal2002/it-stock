# Dokumentasi Teknis - IT Asset Keeper

Dokumen ini menjelaskan arsitektur sistem, struktur database, dan alur kerja fitur-fitur baru yang diimplementasikan.

## Sistem Autentikasi
Sistem menggunakan login terpusat dengan kredensial yang divalidasi.
- **Username**: nafal
- **Password**: nafal123
- **Bypass**: Fitur pendaftaran (SignUp) telah dihapus untuk meningkatkan keamanan akses internal.

## Arsitektur Sistem

Aplikasi ini menggunakan pola **Single Page Application (SPA)** dengan rendering sisi klien.
*   **Routing**: TanStack Router untuk navigasi yang type-safe.
*   **Data Fetching**: TanStack Query untuk caching dan sinkronisasi status server dengan global error handling menggunakan `try-catch`.
*   **Real-time**: Supabase Postgres Changes untuk pembaruan UI instan tanpa refresh.
*   **Storage**: Supabase Storage untuk penyimpanan gambar produk dengan kompresi WebP di sisi klien.

## Struktur Database

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
