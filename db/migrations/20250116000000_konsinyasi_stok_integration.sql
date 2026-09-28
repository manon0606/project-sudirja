-- ============================================================================
-- Migration: 20250116000000_konsinyasi_stok_integration.sql
-- Feature  : Konsinyasi ↔ stok & penjualan (satuan per item)
-- Engine   : MySQL 5.7
--
-- Tujuan :
--   1. Konsinyasi menambah stok produk ke satuan terpilih (produk_satuan_id).
--   2. Penjualan (pesanan) mengurangi stok dari satuan yg dipilih di form.
--   3. Sisa konsinyasi yg dikembalikan mengurangi stok.
--
-- Snapshot satuan disimpan di konsinyasi_item agar stabil walau harga/satuan
-- produk berubah. pesanan_item mendapat produk_satuan_id (nullable) utk
-- mengurangi stok dari satuan yg benar.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

-- Item konsinyasi: tautkan ke satuan produk + snapshot nama satuan.
ALTER TABLE konsinyasi_item
  ADD COLUMN produk_satuan_id INT UNSIGNED NULL AFTER produk_id,
  ADD COLUMN satuan_nama VARCHAR(100) NULL,
  ADD KEY idx_kit_produk_satuan (produk_satuan_id),
  ADD CONSTRAINT fk_kit_produk_satuan FOREIGN KEY (produk_satuan_id) REFERENCES produk_satuan(id) ON DELETE SET NULL;

-- Item pesanan: tautkan satuan yg terjual (opsional utk legacy).
ALTER TABLE pesanan_item
  ADD COLUMN produk_satuan_id INT UNSIGNED NULL AFTER produk_id,
  ADD KEY idx_pi_produk_satuan (produk_satuan_id),
  ADD CONSTRAINT fk_pi_produk_satuan FOREIGN KEY (produk_satuan_id) REFERENCES produk_satuan(id) ON DELETE SET NULL;

-- DOWN -------------------------------------------------------------------------
-- ALTER TABLE konsinyasi_item DROP FOREIGN KEY fk_kit_produk_satuan;
-- ALTER TABLE konsinyasi_item DROP KEY idx_kit_produk_satuan, DROP COLUMN produk_satuan_id, DROP COLUMN satuan_nama;
-- ALTER TABLE pesanan_item DROP FOREIGN KEY fk_pi_produk_satuan;
-- ALTER TABLE pesanan_item DROP KEY idx_pi_produk_satuan, DROP COLUMN produk_satuan_id;
