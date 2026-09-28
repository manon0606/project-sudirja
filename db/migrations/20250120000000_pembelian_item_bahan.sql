-- ============================================================================
-- Migration: 20250120000000_pembelian_item_bahan.sql
-- Fitur    : Bahan kebutuhan repack per item pembelian (mengikuti desain V3.1
--            "Bahan Kebutuhan Repack").
-- Sifat    : ADITIF (tabel baru + 2 kolom baru, semua punya DEFAULT sehingga
--            data lama tetap valid).
--
-- Aturan bisnis:
--   * Bahan repack TIDAK menambah stok (bukan barang dagangan).
--   * Biaya bahan menambah biaya pembelian item sehingga ikut menghitung laba:
--     laba = (harga jual - harga beli efektif) * qty - total biaya bahan.
--   * Baris bahan ikut terhapus saat pembelian/item dihapus (ON DELETE CASCADE).
-- ============================================================================

CREATE TABLE IF NOT EXISTS pembelian_item_bahan (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pembelian_item_id  INT UNSIGNED  NOT NULL,
  nama_barang        VARCHAR(150)  NOT NULL,            -- mis. Plastik 250g, Label
  biaya              DECIMAL(12,2) NOT NULL DEFAULT 0,  -- biaya per item pembelian
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bahan_item (pembelian_item_id),
  CONSTRAINT fk_bahan_item FOREIGN KEY (pembelian_item_id)
    REFERENCES pembelian_item (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flag repack pada item pembelian (desain V3.1: toggle "Repack" + Jumlah Repack).
ALTER TABLE pembelian_item
  ADD COLUMN is_repack     TINYINT(1)   NOT NULL DEFAULT 0 AFTER subtotal,
  ADD COLUMN jumlah_repack INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_repack;
