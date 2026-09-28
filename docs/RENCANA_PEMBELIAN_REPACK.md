# Rencana: Pembelian Multi-Satuan (Repack) & Produk Baru

Dokumen ini merangkum hasil diskusi flow pembelian dan keputusan yang sudah
disepakati. Fase 1 sudah diimplementasikan; Fase 2 menunggu pengerjaan.

## Masalah

1. **Produk benar-benar baru.** `createPembelian` mewajibkan setiap item menunjuk
   `produk_satuan` yang sudah ada (`src/lib/pembelian-service.ts:289-311` — item
   tanpa satuan jatuh ke satuan pertama produk; produk tanpa satuan →
   `SATUAN_REQUIRED`). Untuk membeli produk baru, user harus keluar ke menu
   Produk lebih dulu (buat kategori/merk/satuan/kode item).
2. **Repack 1 kemasan → banyak satuan jual.** Relasi item pembelian ↔ satuan
   saat ini 1:1 (`pembelian_item.produk_satuan_id`,
   `db/migrations/20250117000000_admin_pembelian.sql:33-53`), sedangkan kebutuhan
   nyata: beli 1 ball snack lalu dijual per 250 g / 500 g / 750 g (1:N) dengan
   alokasi harga beli per satuan hasil.

## Keputusan

| Topik | Keputusan |
|---|---|
| Repack | **Pecahan eksplisit per item pembelian** (opsi B1) — bukan konversi bertingkat otomatis, bukan template per produk (template bisa menyusul) |
| Produk baru | **Quick-create inline di modal pembelian** (produk + satuan + kategori/merk), tanpa perubahan skema |
| Alokasi HPP | **Otomatis proporsional berdasarkan isi/gramasi**, bisa di-override manual per pecahan |
| Urutan | Fase 1 (quick-create + kolom Satuan di bulk) → Fase 2 (pecahan/repack) |

## Fase 1 (selesai)

- Modal pembelian: tombol **"Produk Baru"** → form inline (SKU, nama, kategori/merk
  existing atau baru, daftar satuan + kode item + harga jual) → `createProduk` →
  produk langsung masuk sebagai item pembelian.
- Bulk pembelian: kolom **Satuan** (nama satuan produk) sehingga stok masuk ke
  satuan yang diminta, bukan selalu satuan pertama.

## Fase 2 — Pecahan (repack)

**Status: backend selesai & terverifikasi** (migrasi `20250119000000_pembelian_item_pecahan.sql`,
`pembelian-service.ts`, `pembelian-types.ts`). Bukti: 1 Ball Rp 500.000 dipecah
20×250 g + 10×500 g + 10×750 g → stok 250=20, 500=10, 750=10, satuan beli (Ball)
tidak bertambah; alokasi 7.142,86 / 14.285,71 / 21.428,57 dengan total **persis**
Rp 500.000; override manual dihormati (Pack 250 alokasi 10.000 → Pack 500 menerima
sisa Rp 280.000); item tanpa pecahan tetap menambah stok satuan beli; menghapus
pembelian membalik stok semua pecahan (`stok_history` tipe `out`). UI panel
"Pecah / Repack" dikerjakan terpisah.

### Perbaikan sekutu (ditemukan saat verifikasi Fase 2)

`generateNo()` di `pembelian-service.ts` memakai `COUNT(*)` baris hari itu + 1,
sehingga **menghapus pembelian lalu membuat pembelian baru di hari yang sama**
menghasilkan nomor duplikat → `ER_DUP_ENTRY` → 500 "Terjadi kesalahan server".
Diperbaiki: nomor diambil dari `MAX(urutan)` + 1 dan insert diulang bila tetap
tabrakan. Terverifikasi: hapus `PO-...-003` → pembelian baru sukses sebagai `PO-...-004`.

### Skema (satu migrasi aditif)

```sql
CREATE TABLE pembelian_item_pecahan (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pembelian_item_id  INT UNSIGNED  NOT NULL,
  produk_satuan_id   INT UNSIGNED  NOT NULL,   -- satuan jual hasil pecahan
  satuan_nama        VARCHAR(100)  NULL,
  qty                INT UNSIGNED  NOT NULL,   -- jumlah unit hasil
  isi_base           DECIMAL(12,3) NULL,       -- gramasi/isi (250/500/750) untuk alokasi
  harga_beli_alokasi DECIMAL(12,2) NOT NULL,   -- HPP per unit pecahan
  subtotal_alokasi   DECIMAL(12,2) NOT NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pecahan_item (pembelian_item_id),
  CONSTRAINT fk_pecahan_item FOREIGN KEY (pembelian_item_id)
    REFERENCES pembelian_item (id) ON DELETE CASCADE,
  CONSTRAINT fk_pecahan_ps FOREIGN KEY (produk_satuan_id)
    REFERENCES produk_satuan (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Aturan service

- Item beli tetap 1 baris (satuan beli + qty + harga beli total). Pecahan
  opsional: tanpa pecahan = perilaku sekarang (stok masuk ke satuan beli).
- Dengan pecahan: stok bertambah ke **setiap** `produk_satuan` pecahan
  (`mutasiStok` + `stok_history`, catatan menyebut nomor pembelian + asal item),
  dan **tidak** menambah stok ke satuan beli.
- Alokasi HPP: default proporsional `isi_base × qty` antar pecahan
  (`harga_beli_alokasi = harga_beli_item × isi_pecahan / total_isi`); user boleh
  override manual. Selisih (rendemen/sisa) dicatat agar total alokasi = harga beli item.
- `deletePembelian` membalik stok semua pecahan (bukan satuan beli).
- Validasi: minimal 1 pecahan bila ada; setiap pecahan wajib `produk_satuan_id`
  milik produk yang sama; qty ≥ 1; tidak boleh ada dua pecahan dengan satuan sama.

### Kontrak API

- `CreatePembelianItemInput` + `pecahan?: Array<{ produkSatuanId; qty; isiBase?; hargaBeliAlokasi? }>`.
- `PembelianItemDTO` + `pecahan: Array<{ id; produkSatuanId; satuanNama; qty; isiBase; hargaBeliAlokasi; subtotalAlokasi }>`.
- Laporan laba & PDF memakai alokasi pecahan bila ada: laba item berpecahan =
  Σ `(harga_jual_satuan − harga_beli_alokasi) × qty` (kolom `harga_jual_satuan`
  diambil dari harga jual satuan saat pembelian), bukan dari harga beli item.
  Header `estimasiLaba`/CSV/PDF laporan pembelian otomatis ikut nilai baru ini.
  Terverifikasi: 1 Ball Rp 500.000 → pecahan 250/500/750 g (jual 12.000/22.000/32.000)
  menghasilkan laba Rp 280.000 = 780.000 − 500.000.

### UI

- Di baris item pembelian: tombol **"Pecah / Repack"** → panel kecil berisi baris
  pecahan (Satuan dari satuan produk, Qty, Isi/gram, Harga beli terisi otomatis
  proporsional dan bisa diedit), plus indikator **total alokasi vs harga beli item**
  (selisih ditampilkan sebagai sisa/rendemen).
- Satuan hasil yang belum terdaftar dibuat **inline** dari panel pecahan: pilihan
  `+ Satuan baru…` → form Nama satuan + Jumlah unit → `createSatuan` +
  `updateProduk` (menambah `produk_satuan` untuk SKU itu, `kodeItem` unik,
  harga jual 0) → langsung terpilih di baris pecahan. **Selesai & terverifikasi**
  (uji: `Pack 1000` → `produk_satuan` id 7 `BALL-001-PACK-1000`, stok +5).
- Kolom **Laba** per baris pecahan + total laba di indikator panel; tampil juga di
  Detail Pembelian. **Selesai**.
- Bulk: kolom opsional `Pecahan` format `Satuan:Qty:Isi` dipisah `;`
  (mis. `Pcs:20:250;Pcs:10:500`). **Selesai & terverifikasi** (CSV
  `Ball` + `Pack 250:20:250;Pack 500:10:500` → pecahan ps 4/5, alokasi 12.500/25.000
  proporsional, stok 40/20, satuan beli tidak bertambah).

## Kriteria selesai Fase 2

1. Beli 1 ball (harga Rp X) dengan pecahan 250 g/500 g/750 g → stok bertambah di
   3 `produk_satuan` hasil, satuan beli tidak bertambah; total alokasi = Rp X.
2. HPP per pecahan proporsional dan bisa di-override; tersimpan & tampil di detail.
3. Hapus pembelian → stok semua pecahan kembali ke nilai semula (`stok_history` tercatat).
4. Pembelian tanpa pecahan tetap berperilaku seperti sekarang (backward compatible).
5. `tsc` 0 error, lint ≤ baseline, verifikasi e2e browser + DB di DB uji terisolasi.

## Fase 3 — Bahan Kebutuhan Repack, Produk Baru & Laporan (desain V3.1)

Menyelaraskan form Buat Pembelian dengan desain V3.1 dan melengkapi alur produk baru.

### Model data

- Tabel baru `pembelian_item_bahan` (migrasi `20250120000000_pembelian_item_bahan.sql`):
  `pembelian_item_id` (FK CASCADE), `nama_barang`, `biaya DECIMAL(12,2)`, `created_at`.
- `pembelian_item` dapat `is_repack` + `jumlah_repack`; item membawa array `bahan`.
- **Biaya bahan tidak menambah stok**, tetapi menambah biaya pembelian item dan
  mengurangi laba (`totalBiayaRepack` di ringkasan pembelian).

### UI (form Buat Pembelian)

- Kolom **Repack** per item: toggle + tombol panel. Panel berisi **Jumlah Repack**,
  **Bahan Kebutuhan Repack** (Tambah Bahan → Nama Barang + Biaya, bisa dihapus),
  indikator `Total Biaya Repack`, lalu blok **Satuan Jual Hasil Repack** (pecahan).
- **Ringkasan Total** = Subtotal Pembelian + Total Biaya Repack + PPn.
- **Produk Baru** (inline, tanpa keluar form): SKU, Nama, Kategori/Merk (bisa
  `+ baru`), **Satuan wajib** (satuan baru inline: nama + jumlah unit), kode item
  (barcode, unik), harga jual, dan **Bahan Kebutuhan Repack** — biaya bahan ini
  ikut terbawa ke item pembelian yang dibuat.
- Produk yang tidak ada di master: pencarian menampilkan
  `Produk "X" belum ada di master produk.` + tombol **Buat Produk Baru (satuan wajib)**
  → produk otomatis dibuat di master lengkap dengan satuannya.

### Laporan keuangan

- Ringkasan: baris tambahan `↳ termasuk biaya bahan repack` di bawah Total Pembelian (PO).
- Rincian pembelian: kolom **Biaya Repack** dan **Estimasi Laba**, plus baris TOTAL.
- PDF (`laporan-pdf.ts`) menyesuaikan: baris biaya repack, kolom Biaya Repack &
  Estimasi Laba pada tabel Pembelian Stok.
- `totalPembelian`/`grandTotal` dari API sudah memuat biaya repack (klien tidak
  menghitung ulang).

### Bukti verifikasi (DB uji `web_sudirja_test`, server :3100)

- Item IND-001 10 Dus @2.000 + bahan 30.000 + 20.000 → Ringkasan Total
  Subtotal Rp 20.000 + Biaya Repack Rp 50.000 + PPn 10% Rp 7.000 = **Rp 77.000**;
  estimasi laba Rp −20.000. Pecahan Pcs 40 alokasi Rp 70.000 (harga beli + bahan).
- Produk tidak ada (`ZZZ-999`) → ajakan buat produk baru; dibuat `SNACK-888`
  dengan satuan baru **Pack 500** (jumlah unit 500) + kode item `SNACK-888-PACK-500`
  + bahan `Plastik Pack` Rp 20.000 → PO-20260928-002 Total Rp 22.000, laba
  Rp −12.000, stok `Pack 500` = 2 (`stok_history` "in"), bahan tersimpan di
  `pembelian_item_bahan`.
- Validasi satuan wajib: simpan produk baru tanpa satuan → ditolak
  (`Satuan 1: pilih satuannya.`).
- Laporan harian 28 Sep 2026: Total Pembelian (PO) Rp 99.000, baris "termasuk
  biaya bahan repack" Rp 70.000, rincian 2 pembelian dengan kolom Biaya Repack
  (50.000 / 20.000) dan Estimasi Laba (−20.000 / −12.000), total Rp −32.000;
  Export PDF tanpa error JS.
