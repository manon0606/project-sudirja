-- ============================================================================
-- Migration: 20250119000000_pembelian_item_pecahan.sql
-- Feature  : Pecahan/repack pada item pembelian (1 kemasan beli → N satuan jual)
-- Engine   : MySQL 5.7
--
-- Goal : Kasus nyata "beli 1 ball snack, dijual per 250 g / 500 g / 750 g".
--        Item pembelian tetap 1 baris (satuan beli + qty + harga beli), lalu
--        punya N baris pecahan. Stok bertambah ke SETIAP produk_satuan pecahan
--        dan TIDAK menambah stok satuan beli; harga beli item dialokasikan ke
--        tiap pecahan (default proporsional isi_base x qty, bisa di-override).
--        Tanpa baris pecahan = perilaku lama (stok masuk ke satuan beli).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE pembelian_item_pecahan (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pembelian_item_id  INT UNSIGNED  NOT NULL,
  produk_satuan_id   INT UNSIGNED  NOT NULL,
  satuan_nama        VARCHAR(100)  NULL,
  qty                INT UNSIGNED  NOT NULL DEFAULT 0,
  isi_base           DECIMAL(12,3) NULL,            -- gramasi/isi utk dasar alokasi
  harga_beli_alokasi DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal_alokasi   DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Harga jual satuan hasil pada saat pembelian (dasar laba estimasi per pecahan).
  harga_jual_satuan  DECIMAL(12,2) NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pecahan_item (pembelian_item_id),
  KEY idx_pecahan_ps (produk_satuan_id),
  CONSTRAINT fk_pecahan_item FOREIGN KEY (pembelian_item_id)
    REFERENCES pembelian_item (id) ON DELETE CASCADE,
  CONSTRAINT fk_pecahan_ps FOREIGN KEY (produk_satuan_id)
    REFERENCES produk_satuan (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------
-- DROP TABLE IF EXISTS pembelian_item_pecahan;
