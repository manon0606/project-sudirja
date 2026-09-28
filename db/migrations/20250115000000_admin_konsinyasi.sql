-- ============================================================================
-- Migration: 20250115000000_admin_konsinyasi.sql
-- Feature  : Admin konsinyasi — titipan barang dari supplier
-- Engine   : MySQL 5.7
-- Desain   : Header konsinyasi (nomor unik, tanggal, supplier_id FK, status)
--            + konsinyasi_item (produk terkait + qty & harga snapshot).
--            Supplier wajib dari tabel supplier (tidak input bebas).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE konsinyasi (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  no_konsinyasi    VARCHAR(30)   NOT NULL,                 -- "KON-YYYYMMDD-NNN"
  tanggal          DATETIME      NOT NULL,
  supplier_id      INT UNSIGNED  NOT NULL,
  catatan          VARCHAR(255)  NULL,
  status           ENUM('aktif','selesai') NOT NULL DEFAULT 'aktif',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_konsinyasi_no (no_konsinyasi),
  KEY idx_konsinyasi_supplier (supplier_id),
  KEY idx_konsinyasi_status (status),
  KEY idx_konsinyasi_tanggal (tanggal),
  CONSTRAINT fk_konsinyasi_supplier FOREIGN KEY (supplier_id) REFERENCES supplier(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE konsinyasi_item (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  konsinyasi_id     INT UNSIGNED  NOT NULL,
  produk_id         INT UNSIGNED  NULL,
  sku               VARCHAR(50)   NOT NULL,
  nama_produk       VARCHAR(200)  NOT NULL,
  qty_konsinyasi    INT UNSIGNED  NOT NULL DEFAULT 0,
  qty_terjual       INT UNSIGNED  NOT NULL DEFAULT 0,
  qty_dikembalikan  INT UNSIGNED  NOT NULL DEFAULT 0,
  harga_beli        DECIMAL(12,2) NOT NULL DEFAULT 0,
  harga_jual        DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_konsinyasi (konsinyasi_id),
  KEY idx_item_produk (produk_id),
  CONSTRAINT fk_kit_konsinyasi FOREIGN KEY (konsinyasi_id) REFERENCES konsinyasi(id) ON DELETE CASCADE,
  CONSTRAINT fk_kit_produk FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------
-- DROP TABLE IF EXISTS konsinyasi_item;
-- DROP TABLE IF EXISTS konsinyasi;
