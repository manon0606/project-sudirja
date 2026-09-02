# Sudirja Next — Admin Backoffice

Sistem administrasi toko Sudirja (Next.js App Router + MySQL). Berisi portal
admin lengkap: pesanan, produk, stok, promo, user/role/ACL/komisi, pembelian,
konsinyasi, laporan keuangan, pelanggan, supplier, commerce (pesanan online +
kurir), pemetaan ongkir, dan settings API key POS.

## Mulai

```bash
pnpm install
pnpm dev
# Buka http://localhost:3000/backoffice-sudirja/login
```

- Sesuaikan kredensial DB di `.env.local` (contoh: `MYSQL_DATABASE=web_sudirja`).
- Jalankan migrasi SQL di `db/migrations/` secara berurutan terhadap DB tsb.

## Dokumentasi

- **[docs/ADMIN_FEATURES.md](docs/ADMIN_FEATURES.md)** — ringkasan semua fitur
  admin, menu, konsistensi UI tombol aksi, integrasi antar fitur, dan ACL.
- **[docs/ADMIN_API.md](docs/ADMIN_API.md)** — dokumentasi API lengkap seluruh
  modul (auth, pesanan, produk, stok, promo, user/role/komisi, supplier,
  pelanggan, ongkir, konsinyasi, pembelian, laporan, settings).

## Struktur singkat

```
src/app/backoffice-sudirja/   # halaman & komponen UI admin
src/app/api/backoffice-sudirja/ # route handler (API)
src/lib/                        # service + types + client api per modul
db/migrations/                  # skema database (SQL)
```

## Konvensi

- Envelope API: `{ ok: true, data }` / `{ ok: false, error: { code, message } }`.
- Semua endpoint admin butuh sesi login (cookie `sudirja_admin_session`);
  `POST /pesanan` juga menerima API key POS (`X-API-Key`) saat mode online.
- UI tombol aksi header memakai komponen shared `ActionButtons.tsx` agar
  konsisten (Export outline hijau `px-5 py-3`, Tambah solid hijau `px-6 py-3`).
