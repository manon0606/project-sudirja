# Dokumentasi API Admin Sudirja

Base URL: `/api/backoffice-sudirja`

Semua endpoint memerlukan **session admin** (cookie `sudirja_admin_session`,
didapat dari `POST /auth/login`). Kecuali dinyatakan, response tanpa sesi = `401`.

## Envelope

```jsonc
// Sukses
{ "ok": true, "data": ... }
// Gagal
{ "ok": false, "error": { "code": "...", "message": "...", "details": { ... } } }
```

Error codes umum: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `UNAUTHORIZED` (401),
`INTERNAL_ERROR` (500), dan kode spesifik per modul.

---

## Dashboard

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/dashboard` | Ringkasan dashboard (data real). Params: `range=7\|30\|year` (default 7). Response `data`: `{range, summary{totalPenjualan,totalPesanan,produkTerjual,pelangganBaru,pertumbuhan{…}}, grafik[{label,tanggal,total,jumlah}], statusHariIni{selesai,diproses,lainnya,total}, pesananTerbaru[{noPesanan,asal,nama,total,status,waktu}]}` |

Ringkasan & grafik dihitung dari pesanan (status ≠ Dibatalkan/Dikembalikan) pada
rentang: penjualan total nominal, jumlah pesanan, qty produk terjual, dan
pelanggan baru (tabel pelanggan). `pertumbuhan` = % naik/turun vs periode
sebelumnya (null bila periode sebelumnya kosong).

---

## Auth

| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/auth/register` | Buat admin baru (otomatis user profil superadmin). Body: `{username,email,password,fullName}` → 201 |
| POST | `/auth/login` | Login admin → set cookie + data admin (role/permissions). Body: `{username,password}` |
| POST | `/auth/logout` | Hapus sesi |
| GET | `/auth/me` | Profil admin yang login (role, roleLabel, permissions, isSuperadmin) |

Response login/me `data.admin`: `{id,username,email,fullName,role,roleLabel,permissions[],isSuperadmin,createdAt}`.

---

## Pesanan

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/pesanan` | List pesanan. Params: `page,pageSize,search,status,asal(offline\|commerce),statusPengiriman,dateFrom,dateTo,sortBy,sortOrder` |
| POST | `/pesanan` | Buat pesanan. Body: `{items[],metodeBayar,asal?,pelangganId?,voucher?,uangDiterima?,cashIn?,cashOut?,catatan?}`. **Commerce wajib `pelangganId`** (dari master). Item: `{produkId?,produkSatuanId?,namaProduk,qty,harga}`. Auth: sesi admin **atau** header `X-API-Key` POS (saat mode online settings). Mengurangi stok & mencatat komisi/konsinyasi terjual. |
| GET | `/pesanan/[no]` | Detail pesanan + items + pelanggan/kurir |
| PATCH | `/pesanan/[no]` | Update pengiriman commerce. Body: `{kurirId?,statusPengiriman?(Menunggu Kurir\|Diantar\|Selesai)}` |
| POST | `/pesanan/[no]/retur` | Buat retur |
| GET | `/pesanan/produk` | Cari produk utk form pesanan: `?search=` → `[{produkId,sku,nama,harga,stok,satuan[]}]` |
| GET | `/pesanan/kredit` | List pesanan kredit |
| GET | `/pesanan/[no]/kredit` | Detail kredit + pembayaran |
| POST | `/pesanan/kredit/[no]` | Tambah angsuran |
| GET | `/pesanan/retur` | List retur |
| GET | `/kurir` | Daftar user role kurir (aktif) |

Catatan pesanan: kolom `asal_pesanan`, `pelanggan_id`, `cash_in`, `cash_out`,
`status_pengiriman`, `kurir_id`, dll. Penjualan offline status awal `Selesai`,
commerce `Diproses` + `status_pengiriman=Menunggu Kurir`.

---

## Produk & referensi

| Method | Path | Keterangan |
|--------|------|-----------|
| GET/POST | `/products/produk` | List (search/sort/paginate) / create produk. ProdukDTO: `{id,sku,nama,deskripsi,gambarUrl,kategoriKode,nama,merkKode,nama,status,createdAt,satuan[]}` — `satuan[]` berisi `{id,satuanKode,satuanNama,jumlahUnit,kodeItem,harga}` (**id = produk_satuan.id** utk stok) |
| GET/PATCH/DELETE | `/products/produk/[sku]` | Detail/update/hapus produk |
| POST | `/products/produk/bulk` | Bulk upsert produk (multi-satuan via CSV) |
| GET/POST | `/products/satuan`, `/products/merk`, `/products/kategori` | CRUD referensi (kode prefix SAT/MRK/KAT) |
| PATCH/DELETE | `/products/satuan/[kode]` dst | Update/hapus referensi |

---

## Stok

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/stok` | List stok per SKU (agregat satuan). Params `search` dst |
| PATCH | `/stok/[sku]` | Mutasi stok. Body: `{catatan?,satuan:[{satuanKode,qty?,bufferStok?,batasBawah?}]}` — mencatat `stok_history` |
| POST | `/stok/bulk` | Bulk update stok banyak SKU |
| GET | `/stok/[sku]/history` | Riwayat mutasi stok |

Stok tersimpan per `produk_satuan_id` (unique). Pembelian & konsinyasi menambah;
pesanan & retur mengurangi; konsinyasi selesai/hapus mengembalikan sisa.

---

## Promo

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/promo` | List promo: `page,pageSize,search,tipe,sortBy,sortOrder` |
| POST | `/promo` | Create promo. Body: `{kode,nama,tipe(Diskon Ongkir\|Diskon Nominal\|Diskon %),deskripsi?,nilaiDiskon,minimalBelanja?,maksimalDiskon?,tanggalMulai,tanggalBerakhir,batasKuota,syaratKetentuan?,isActive?}` |
| GET/PATCH/DELETE | `/promo/[id]` | Detail / update (partial) / hapus |
| POST | `/promo/bulk` | Bulk create dari CSV |
| GET | `/promo/validate` | Validasi voucher utk pesanan: `?kode=&subtotal=` → `{valid,message,promo?{…,diskonAmount}}` |

Voucher aktif & valid dipakai otomatis di `POST /pesanan` (voucher = kode promo),
kuota `jumlah_digunakan` bertambah.

---

## User & Role & Komisi

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/users` | List user: `page,pageSize,search,role,sortBy,sortOrder`. DTO: `{id,adminId,username,fullName,role,roleLabel,phone,email,isActive}` |
| POST | `/users` | Create user = **buat admin (username+password) + profil user (data pribadi+role)** dalam satu transaksi. Body: `{username,password,fullName,role,phone?,email?,isActive?}` |
| GET/PATCH/DELETE | `/users/[id]` | Detail/update (username/password/fullName/role/phone/email/isActive)/hapus |
| POST | `/users/bulk` | Bulk create user |
| GET/POST | `/roles` | List role dinamis / create role `{name,label,permissions[]}` (otomatis masuk komisi_settings) |
| GET/PATCH/DELETE | `/roles/[name]` | Detail/update (label,permissions)/hapus (non-system, tidak dipakai user) |
| GET | `/komisi/settings` | Daftar setting komisi per role (roleLabel + persen + aktif) |
| PATCH | `/komisi/settings` | Update: `{role,persenKomisi,aktif}` |
| GET | `/komisi` | Rekap komisi per user `?search&role&page`; dengan `?userId=` → detail transaksi komisi |

Role & ACL: role menentukan `permissions` (kode fitur) yang dipakai sidebar &
guard. Superadmin selalu akses semua.

---

## Supplier / Pelanggan / Pemetaan-Ongkir

| Method | Path | Keterangan |
|--------|------|-----------|
| GET/POST | `/supplier` | List (search nama/kota/telepon) / create. Field: kode auto `SUP-xxx`, nama, alamat, kota, provinsi, negara, kodepos, telepon, fax, bank, norek, atasnama, kontak, email, keterangan, isActive |
| GET/PATCH/DELETE | `/supplier/[id]` | Detail/update/hapus |
| POST | `/supplier/bulk` | Bulk create |
| GET/POST | `/pelanggan` | List / create pelanggan (kode auto `CUST-xxx`). DTO sertakan statistik `totalTransaksi,totalBelanja` (commerce) |
| GET/PATCH/DELETE | `/pelanggan/[id]` | Detail/update/hapus |
| POST | `/pelanggan/bulk` | Bulk create |
| GET/POST | `/ongkir` | List pemetaan kecamatan→ongkir / create |
| PATCH/DELETE | `/ongkir/[kode]` | Update/hapus |
| POST | `/ongkir/bulk` | Bulk create |

---

## Konsinyasi

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/konsinyasi` | List: `page,pageSize,search,status(aktif\|selesai),dateFrom,dateTo,sortBy,sortOrder`. DTO: header + items `{produkSatuanId,satuanNama,qtyKonsinyasi,qtyTerjual,qtyDikembalikan,hargaBeli,hargaJual}` |
| POST | `/konsinyasi` | Create (menambah stok ke satuan). Body: `{tanggal,supplierId,catatan?,items[]}` — item wajib `produkSatuanId` |
| GET/PATCH/DELETE | `/konsinyasi/[id]` | Detail / PATCH `{status}` (selesai → kurangi sisa dari stok) / DELETE (tarik sisa dari stok) |
| POST | `/konsinyasi/bulk` | Bulk create |

---

## Pembelian

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/pembelian` | List: `page,pageSize,search,dateFrom,dateTo,sortBy,sortOrder`. DTO sertakan `totalPembelian,totalPpn,grandTotal,estimasiLaba` |
| POST | `/pembelian` | Create (menambah stok). Body: `{tanggal,supplierId,ppn?,catatan?,items[]}` — item `{produkId?,produkSatuanId,sku,namaProduk,qty,hargaBeli,hargaJual,diskon?}` |
| GET/DELETE | `/pembelian/[id]` | Detail / DELETE (stok dikembalikan) |
| POST | `/pembelian/bulk` | Bulk create |

---

## Laporan keuangan

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/laporan` | Generate laporan real-time. Params: `tipe=daily\|monthly\|yearly\|custom`, `dateFrom=YYYY-MM-DD` (daily: tanggal; monthly: `YYYY-MM`; yearly: `YYYY`), `dateTo` (custom). Response: `{id,tipe,periodeMulai,periodeAkhir,summary,rincian{penjualan,pembelian,konsinyasi,cashFlow}}` |

Definisi summary:
- Penjualan offline & online (pesanan status ≠ Dibatalkan/Dikembalikan) → pemasukan.
- Cash in per pesanan → pemasukan.
- Pembelian (grand total incl. PPN), konsinyasi dibayar ke supplier, cash out → pengeluaran.
- **Laba bersih = totalPemasukan − totalPengeluaran.**

---

## Settings (API key POS)

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/settings` | Status online + hint API key (hanya superadmin) |
| PATCH | `/settings` | `{isOnline}` utk toggle, atau `{regenerate:true}` → API key baru (tampil sekali) |

API key dipakai aplikasi POS via header `X-API-Key` pada `POST /pesanan` saat mode
online aktif. Tanpa key valid → 401. Settings hanya superadmin (403 utk lainnya).
