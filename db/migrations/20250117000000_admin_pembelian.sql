-- ============================================================================
-- Migration: 20250117000000_admin_pembelian.sql
-- Feature  : Admin pembelian — pencatatan pembelian produk dari supplier
-- Engine   : MySQL 5.7
--
-- Goal : Mencatat setiap pembelian produk dari supplier sehingga nanti bisa
--        dihitung keuntungan (harga jual vs harga beli). Pembelian menambah
--        stok produk ke satuan terpilih (seperti konsinyasi).
--
-- Skema : Header pembelian (nomor unik, tanggal, supplier_id FK, ppn, catatan)
--         + pembelian_item (satuan produk, qty, harga beli/jual, diskon %,
--         subtotal).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE pembelian (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  no_pembelian     VARCHAR(30)   NOT NULL,                 -- "PO-YYYYMMDD-NNN"
  tanggal          DATETIME      NOT NULL,
  supplier_id      INT UNSIGNED  NOT NULL,
  ppn              DECIMAL(5,2)  NOT NULL DEFAULT 0,       -- persen PPN
  catatan          VARCHAR(255)  NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pembelian_no (no_pembelian),
  KEY idx_pembelian_supplier (supplier_id),
  KEY idx_pembelian_tanggal (tanggal),
  CONSTRAINT fk_pembelian_supplier FOREIGN KEY (supplier_id) REFERENCES supplier(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pembelian_item (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pembelian_id      INT UNSIGNED  NOT NULL,
  produk_id         INT UNSIGNED  NULL,
  produk_satuan_id  INT UNSIGNED  NULL,
  satuan_nama       VARCHAR(100)  NULL,
  sku               VARCHAR(50)   NOT NULL,
  nama_produk       VARCHAR(200)  NOT NULL,
  qty               INT UNSIGNED  NOT NULL DEFAULT 0,
  harga_beli        DECIMAL(12,2) NOT NULL DEFAULT 0,
  harga_jual        DECIMAL(12,2) NOT NULL DEFAULT 0,
  diskon            DECIMAL(5,2)  NOT NULL DEFAULT 0,     -- persen
  subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_pembelian (pembelian_id),
  KEY idx_item_pembelian_produk (produk_id),
  CONSTRAINT fk_pbl_item_pembelian FOREIGN KEY (pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbl_item_satuan FOREIGN KEY (produk_satuan_id) REFERENCES produk_satuan(id) ON DELETE SET NULL,
  CONSTRAINT fk_pbl_item_produk FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------
-- DROP TABLE IF EXISTS pembelian_item;
-- DROP TABLE IF EXISTS pembelian;
