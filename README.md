# IT Asset Keeper - Sistem Manajemen Inventaris IT

Sistem manajemen inventaris aset IT yang modern, real-time, dan user-friendly. Dibangun menggunakan React, TanStack Start, Tailwind CSS, dan Supabase.

## Fitur Utama

1.  **Manajemen Gambar Produk Lanjut**
    *   Mendukung pengunggahan beberapa gambar sekaligus.
    *   Kompresi gambar otomatis ke format WebP untuk performa optimal.
    *   Fitur Potong (Crop) dan Ubah Ukuran (Resize) interaktif.
    *   Penandaan gambar utama produk.
    *   Validasi format file (JPEG, PNG, WebP).

2.  **Dashboard Monitoring Real-time**
    *   Visualisasi data stok per kategori menggunakan grafik batang interaktif.
    *   Grafik tren transaksi (Masuk/Keluar) dalam 7 hari terakhir.
    *   Notifikasi real-time untuk perubahan status kritis (stok menipis/habis).
    *   Ringkasan aktivitas transaksi terbaru.

3.  **Manajemen Inventaris & Transaksi**
    *   Pencarian dan filter lanjutan (Kategori, Kondisi, Status Stok).
    *   Preview gambar dengan fitur zoom.
    *   Indikator status dengan kode warna (Hijau: Tersedia, Kuning: Menipis, Merah: Habis).
    *   Export data laporan ke format PDF, CSV, dan Excel.

4.  **Keamanan & Audit**
    *   Autentikasi pengguna terintegrasi dengan Supabase.
    *   Audit Trail otomatis untuk setiap perubahan data (Create, Update, Delete).

---

## Panduan Pengguna (User Manual)

### 1. Mengelola Barang
*   **Menambah Barang**: Klik tombol "Tambah Barang" di Dashboard atau halaman Barang. Isi formulir lengkap termasuk mengunggah gambar produk.
*   **Mengedit Barang**: Klik ikon pensil pada baris barang di tabel.
*   **Menghapus Barang**: Klik ikon tempat sampah. Sistem akan menghapus data barang beserta gambar yang terkait di storage.

### 2. Manajemen Gambar
*   Di formulir barang, klik "Tambah Gambar" untuk mengunggah.
*   Klik ikon **Bintang** untuk menjadikan gambar tersebut sebagai gambar utama.
*   Klik ikon **Crop** untuk memotong gambar sesuai rasio yang diinginkan (1:1, 4:3, 16:9, dll) dan melakukan zoom.
*   Klik ikon **X** untuk menghapus gambar.

### 3. Monitoring & Laporan
*   Buka halaman **Dashboard** untuk melihat statistik cepat dan grafik tren.
*   Buka halaman **Transaksi** untuk melihat riwayat masuk/keluar barang.
*   Gunakan tombol **Unduh Laporan** di halaman Barang atau Transaksi untuk mengekspor data ke Excel/CSV. Untuk PDF, gunakan fitur cetak browser (Ctrl+P) yang sudah dioptimalkan tampilannya.

---

## Instalasi & Pengembangan

### Prasyarat
*   Node.js / Bun
*   Akun Supabase (untuk database dan storage)

### Langkah Instalasi
1.  Clone repositori ini.
2.  Instal dependensi: `npm install` atau `bun install`.
3.  Konfigurasi file `.env` dengan kredensial Supabase Anda:
    ```env
    VITE_SUPABASE_URL=your_url
    VITE_SUPABASE_ANON_KEY=your_key
    ```
4.  Jalankan aplikasi: `npm run dev` atau `bun dev`.

### Teknologi yang Digunakan
*   **Framework**: TanStack Start (React)
*   **Styling**: Tailwind CSS + Lucide Icons
*   **Database & Auth**: Supabase
*   **Charts**: Recharts
*   **Animations**: Framer Motion
*   **State Management**: TanStack Query (React Query)
