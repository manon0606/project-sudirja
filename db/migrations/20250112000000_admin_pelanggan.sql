-- ============================================================================
-- Migration: 20250112000000_admin_pelanggan.sql
-- Feature  : Admin pelanggan — entitas master utk commerce/pesanan online
-- Engine   : MySQL 5.7
-- Desain   : Pelanggan adalah entitas master (dibuat manual oleh admin, dan
--            nanti via API register toko online). Pesanan commerce WAJIB
--            terkait pelanggan via FK pesanan.pelanggan_id → pelanggan.id.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE pelanggan (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  kode             VARCHAR(20)   NOT NULL,                 -- "CUST-001"
  nama             VARCHAR(100)  NOT NULL,
  email            VARCHAR(255)  NULL,
  telepon          VARCHAR(30)   NULL,
  alamat           VARCHAR(255)  NULL,
  kecamatan        VARCHAR(100)  NULL,
  is_member        TINYINT(1)    NOT NULL DEFAULT 0,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pelanggan_kode (kode),
  KEY idx_pelanggan_nama (nama),
  KEY idx_pelanggan_telepon (telepon),
  KEY idx_pelanggan_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relasi pesanan commerce → pelanggan (opsional utk legacy, wajib utk baru).
ALTER TABLE pesanan
  ADD COLUMN pelanggan_id INT UNSIGNED NULL AFTER asal_pesanan,
  ADD KEY idx_pesanan_pelanggan (pelanggan_id),
  ADD CONSTRAINT fk_pesanan_pelanggan FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id) ON DELETE SET NULL;

-- DOWN -------------------------------------------------------------------------
-- ALTER TABLE pesanan DROP FOREIGN KEY fk_pesanan_pelanggan;
-- ALTER TABLE pesanan DROP KEY idx_pesanan_pelanggan, DROP COLUMN pelanggan_id;
-- DROP TABLE IF EXISTS pelanggan;
