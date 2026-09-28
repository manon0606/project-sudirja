-- ============================================================================
-- Migration: 20250103000000_admin_stok.sql
-- Feature  : Admin stok (web_sudirja database)
-- Engine   : MySQL 5.7 (explicit TIMESTAMP defaults for strict mode)
-- Desain   : Stok dipecah per (produk × satuan). Karena 1 produk bisa punya
--            BANYAK satuan (Pcs, Dus, dsb), stok di-1:1-kan ke produk_satuan
--            (yang sudah membawa kode_item + harga). stok_history mencatat
--            setiap mutasi (masuk/keluar/penyesuaian) untuk audit & laporan.
--            Saat produk dibuat (manual/bulk), baris stok dibuat otomatis
--            dengan qty 0 — lihat createProdukTx / insertProdukSatuan.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE stok (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  produk_satuan_id  INT UNSIGNED  NOT NULL,   -- 1:1 ke produk_satuan
  qty               INT           NOT NULL DEFAULT 0,     -- boleh minus? tidak; divalidasi di app
  buffer_stok       INT           NOT NULL DEFAULT 0,     -- stok cadangan (buffer)
  batas_bawah       INT           NULL,                   -- batas bawah utk tanda restock (merah di tabel)
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stok_produk_satuan (produk_satuan_id),
  CONSTRAINT fk_stok_produk_satuan FOREIGN KEY (produk_satuan_id)
    REFERENCES produk_satuan (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stok_history (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  stok_id       INT UNSIGNED  NOT NULL,
  tipe          ENUM('in','out','adjust') NOT NULL,   -- masuk / keluar / penyesuaian
  qty_delta     INT           NOT NULL,               -- +masuk / -keluar / 0 utk adjust
  qty_sebelum   INT           NOT NULL,
  qty_sesudah   INT           NOT NULL,
  catatan       VARCHAR(255)  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_history_stok (stok_id),
  KEY idx_history_created (created_at),
  CONSTRAINT fk_history_stok FOREIGN KEY (stok_id)
    REFERENCES stok (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS stok_history;
-- DROP TABLE IF EXISTS stok;
