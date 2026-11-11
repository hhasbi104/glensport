# Courtly — Sport Court Booking System

Aplikasi pemesanan lapangan olahraga berbasis Next.js App Router, React, Tailwind CSS, dan PostgreSQL. Antarmuka dan pesan validasi menggunakan Bahasa Indonesia.

## Fitur

- Booking untuk Futsal, Badminton, dan Tenis dengan daftar lapangan dari database.
- Slot per jam 07.00–22.00, indikator slot terisi, dan harga peak (17.00–21.00) / off-peak.
- Permintaan reservasi menyimpan status `pending`; pengelola dapat menerima, menolak, atau membatalkan pesanan yang telah dikonfirmasi.
- Pencegahan double booking di sisi server dalam transaksi PostgreSQL. Baris lapangan dikunci (`SELECT ... FOR UPDATE`) sebelum cek bentrok dan insert, sehingga dua permintaan serentak untuk lapangan yang sama tidak dapat mengambil slot yang sama.
- Login email/password menggunakan password hash `scrypt` di tabel `users`; admin diarahkan ke dashboard dan user ke halaman booking. Login memakai cookie sesi HttpOnly.
- Dashboard admin menggunakan sesi login admin; tombol bypass hanya tersedia di development. Pembaruan booking menggunakan Server-Sent Events (SSE).
- Saat admin mengonfirmasi booking, aplikasi mengirim template WhatsApp melalui WhatsApp Cloud API. Pesan dikirim setelah status booking berhasil tersimpan.

## Menjalankan aplikasi

Persyaratan: Node.js 20.9+, npm, dan PostgreSQL 14+.

1. Buat database dan tabel, sekaligus data awal lapangan:

   ```sh
   psql -h localhost -p 5432 -U postgres -d sport_court_booking -f database/schema.sql
   ```

2. Salin `.env.example` menjadi `.env.local`. Atur koneksi PostgreSQL, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (minimal 12 karakter), dan `SESSION_SECRET` dengan nilai acak milik sendiri.
3. Untuk notifikasi WhatsApp, isi `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE=id`, dan `WHATSAPP_GRAPH_API_VERSION` di `.env.local`. Buat dan setujui template bahasa Indonesia di WhatsApp Manager dengan body berikut, menggunakan contoh nilai untuk semua variabel:

   ```text
   Halo {{1}}, booking {{2}} pada {{3}} pukul {{4}} telah dikonfirmasi. Total pembayaran: {{5}}.
   ```

   Template harus memiliki lima variabel body dalam urutan tersebut. `WHATSAPP_TEMPLATE_NAME` harus sama dengan nama template yang disetujui. Nomor pelanggan yang diawali `08` otomatis dikirim sebagai `628`.
4. Jika tabel `users` sudah dibuat sebelum fitur login, jalankan migrasi sekali:

   ```sh
   psql -h localhost -p 5432 -U postgres -d sport_court_booking -f database/migrate-auth.sql
   ```

5. Instal dependensi, buat akun admin di database, lalu jalankan aplikasi:

   ```sh
   npm install
   npm run seed:admin
   npm run dev
   ```

6. Login tersedia di `http://localhost:3000/login`; akun admin yang dibuat diarahkan ke dashboard. Pada development, tombol **Masuk langsung sebagai admin** tersedia untuk demo tanpa akun.

Untuk produksi, jalankan `npm run build` lalu `npm run start`. Pastikan kredensial dan secret sudah diganti. Mode auto-login hanya aktif saat `NODE_ENV=development`; jangan jalankan mode development di server publik.

## Deploy ke Vercel dengan Aiven PostgreSQL

1. Buat service **PostgreSQL** di Aiven dan tunggu sampai statusnya **Running**. Dari halaman **Overview**, catat host, port, user, password, dan nama database. Unduh CA certificate service.
2. Jalankan `database/schema.sql` pada service Aiven menggunakan `psql` atau PostgreSQL GUI client. Pastikan tabel dan data awal lapangan berhasil dibuat.
3. Hubungkan repository GitHub ke Vercel melalui **Add New Project**. Pastikan `.env.local` tidak diunggah; file tersebut sudah masuk `.gitignore`.
4. Di pengaturan project Vercel, tambahkan environment variables berikut untuk **Production** (dan Preview jika diperlukan):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` dari detail koneksi PostgreSQL Aiven.
   - `DB_SSL_CA` berisi seluruh isi CA certificate PEM dari Aiven.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (minimal 12 karakter), dan `SESSION_SECRET` (acak, minimal 32 karakter).
   - Variabel `WHATSAPP_*` hanya jika notifikasi WhatsApp akan digunakan.
5. Setelah database dan variabel tersedia, buat akun admin dengan menjalankan `npm run seed:admin` dari komputer lokal yang `.env.local`-nya sementara diatur ke koneksi Aiven yang sama. Untuk `DB_SSL_CA` di `.env.local`, tempel isi CA certificate PEM Aiven; aplikasi menerima baris baru maupun certificate yang tertempel sebagai satu baris. Di Vercel, tempel isi PEM lengkap. Jangan commit atau membagikan file tersebut.
6. Deploy atau redeploy project dari Vercel. Uji halaman booking, login admin, dan pembuatan booking.

Vercel menjalankan fungsi di lingkungan yang dapat berbeda-beda. Fitur pembaruan dashboard admin melalui SSE saat ini memakai listener in-memory, sehingga pembaruan lintas instance tidak dijamin; data tetap tersimpan di PostgreSQL. Untuk notifikasi real-time yang andal, gunakan broker bersama atau polling.

## API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/courts?sport=Futsal` | Daftar lapangan aktif |
| GET | `/api/bookings?date=YYYY-MM-DD` | Slot yang sudah ditahan pada tanggal tersebut |
| POST | `/api/bookings` | Membuat permintaan booking |
| GET | `/api/admin/bookings` | Daftar pesanan (sesi admin) |
| PATCH | `/api/admin/bookings/:id` | Ubah status (sesi admin) |
| GET | `/api/admin/events` | Stream pembaruan SSE (sesi admin) |
| POST | `/api/auth/login` | Validasi email/password dan buat sesi |
| POST | `/api/auth/dev-login` | Bypass admin (development saja) |

Booking perlu menyediakan `courtId`, `date`, `startTime`, `name`, dan `phone`. `email` serta `notes` opsional. Harga selalu dihitung ulang oleh server, bukan dipercaya dari browser. Status `pending` dan `confirmed` dianggap menempati slot; `rejected` dan `cancelled` membebaskannya.

SSE memakai event in-memory untuk deployment satu proses Next.js. Jika menjalankan beberapa instance, hubungkan event ke broker pub/sub bersama seperti Redis agar perubahan lintas instance juga tersiar.
