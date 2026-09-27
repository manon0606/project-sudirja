# Fitur Admin Sudirja — Ringkasan

Sistem backoffice (admin) Sudirja pada `src/app/backoffice-sudirja` + backend API di
`src/app/api/backoffice-sudirja/*` + logika di `src/lib/*`. Semua fitur memakai
envelope respons seragam: `{ ok: true, data }` untuk sukses dan
`{ ok: false, error: { code, message, details? } }` untuk gagal, serta wajib
login admin (session cookie) — kecuali POS via API key pada endpoint pesanan.

## Menu & fitur

| Menu | Halaman | Deskripsi | Status data |
|------|---------|-----------|-------------|
| Dashboard | `/dashboard` | Ringkasan aktivitas | — |
| Pesanan | `/pesanan` | Pesanan POS/offline & manual (bisa offline atau commerce) | Real |
| Pesanan → Kredit | `/pesanan-kredit` | Pesanan kredit + angsuran | Real |
| Pesanan → Pengembalian | `/pengembalian` | Retur pesanan | Real |
| Produk | `/produk` | Daftar produk (SKU, satuan, harga) | Real |
| Produk → Kelola Satuan/Merk/Kategori | `/kelola-*` | Referensi satuan, merk, kategori | Real |
| Stok | `/stok` | Stok per satuan produk + history | Real |
| Promo | `/promo` | Voucher/diskon (aktif dipakai pesanan) | Real |
| User | `/user` | Akun+profil user, **Role & Akses** (ACL), **Komisi** | Real |
| Pembelian | `/pembelian` | Pembelian dari supplier (tambah stok) | Real |
| Konsinyasi | `/konsinyasi` | Titipan barang supplier (tambah stok) | Real |
| Laporan | `/laporan` | Laporan keuangan real-time (pemasukan/pengeluaran/laba) | Real |
| Pelanggan | `/pelanggan` | Master pelanggan (dipakai pesanan commerce) | Real |
| Supplier | `/supplier` | Master supplier (dipakai pembelian & konsinyasi) | Real |
| Commerce | `/commerce` | Pesanan online + proses kurir | Real |
| Pemetaan & Ongkir | `/pemetaan` | Ongkir per kecamatan | Real |
| Settings | `/settings` | API key aplikasi POS (hanya superadmin) | Real |

> Semua data berasal dari database (`web_sudirja`) — tidak ada lagi mock/dummy.

## Konsistensi UI (tombol aksi header)

Setiap halaman CRUD memakai pola tombol yang sama (komponen shared
`components/ActionButtons.tsx`):

- **Export Data** — outline hijau: `px-5 py-3 rounded-lg border-2`, border & teks
  `#27b446`, bg `rgba(39,180,70,0.05)`, ikon `w-5 h-5`.
- **Tambah Data** — solid hijau: `px-6 py-3 rounded-lg`, bg `#27b446`, teks putih,
  ikon `w-5 h-5`; dengan `ChevronDown` bila punya sub-aksi **Manual / Bulk Upload**
  (dropdown item: ikon hijau + judul + deskripsi).
- Keduanya `transition` + `hover:opacity-90`.

Berlaku di: Produk, Satuan, Merk, Kategori, Stok, Promo, User, Pembelian,
Konsinyasi, Pelanggan, Supplier, Pemetaan, Commerce (export), Laporan (export),
Settings (generate/export).

## Integrasi penting antar fitur

- **Pelanggan** (master) → **pesanan commerce** wajib memilih `pelangganId`.
- **Supplier** (master) → **pembelian** & **konsinyasi** wajib memilih supplier.
- **Satuan produk** (`produk_satuan_id`) → pembelian, konsinyasi, dan pesanan
  mengurangi/menambah stok per satuan yang dipilih (catatan `stok_history`).
- **Konsinyasi**: create +stok; jual (pesanan) −stok & update `qty_terjual`;
  retur pesanan → +stok kembali & `qty_terjual` dibatalkan;
  selesai/hapus → sisa dikembalikan −stok.
- **Pembelian**: create +stok; hapus → stok dikembalikan.
- **Promo** aktif valid → dipakai `POST /pesanan` (diskon), kuota berkurang.
- **Cash in/out** opsional per pesanan (dari POS) → bahan **laporan keuangan**.
- **Komisi** per role (kasir/kurir/dll) otomatis tercatat saat pesanan dibuat
  oleh user terkait.

## ACL (akses fitur per role)

Role dinamis di tabel `roles` + permission (kode fitur). Sidebar difilter sesuai
role user terkait; `settings` hanya untuk superadmin.

## Cara menjalankan

```bash
pnpm install
# pastikan MySQL aktif & env MYSQL_* terisi (lihat .env.local)
pnpm dev        # http://localhost:3000
```

Migrasi DB dijalankan manual via `mysql web_sudirja < db/migrations/*.sql`
(urut sesuai timestamp). Lihat `docs/ADMIN_API.md` untuk dokumentasi API lengkap.

## Bulk upload & form pesanan

- Semua flow bulk memakai modal seragam `BulkUploadModal` (panel **Format File** +
  **Unduh Sample File** + hasil `Berhasil: N` + rincian gagal per nomor baris).
- Kolom `Status` opsional di CSV bulk: `nonaktif|tidak|0|false|no|n|inactive|mati`
  → `is_active = 0`; kosong/aktif → aktif. Berlaku untuk ongkir, pelanggan, supplier,
  user, produk, dan promo. Kebijakan yang sama harus dijaga di service (bulk insert
  tidak boleh meng-hardcode `is_active = 1`).
- Bulk konsinyasi: kolom `Satuan` **wajib** (nama satuan yang terdaftar di master
  produk). Server menyimpan `produk_satuan_id`; SKU sama dengan satuan berbeda
  diperbolehkan (satu konsinyasi bisa punya beberapa baris SKU sama).
- Form Pelanggan: `Kecamatan` = select dari data Pemetaan & Ongkir (bukan input teks).
- Form Buat Pesanan Manual (Pesanan): identitas baris = produk + satuan, jadi produk
  sama dengan satuan berbeda menjadi dua baris terpisah; satuan yang sudah dipakai
  baris lain ditandai `(terpakai)` dan tidak bisa dipilih ulang.
- Commerce: search berdasarkan nama pelanggan; bulk `Pilih Kurir (N)` (status
  *Menunggu Kurir*) dan `Selesaikan (N)` (status *Diantar*).
