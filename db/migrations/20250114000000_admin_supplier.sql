-- ============================================================================
-- Migration: 20250114000000_admin_supplier.sql
-- Feature  : Admin supplier — data pemasok barang
-- Engine   : MySQL 5.7
-- Desain   : Tabel supplier menyimpan data lengkap pemasok (nama, alamat,
--            kota, provinsi, negara, kodepos, kontak, bank, dll) sesuai
--            format yang diminta user.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE supplier (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  kode             VARCHAR(20)   NOT NULL,                 -- "SUP-001"
  nama             VARCHAR(150)  NOT NULL,
  alamat           VARCHAR(255)  NULL,
  kota             VARCHAR(100)  NULL,
  provinsi         VARCHAR(100)  NULL,
  negara           VARCHAR(100)  NULL,
  kodepos          VARCHAR(10)   NULL,
  telepon          VARCHAR(30)   NULL,
  fax              VARCHAR(30)   NULL,
  bank             VARCHAR(100)  NULL,
  norek            VARCHAR(50)   NULL,
  atasnama         VARCHAR(150)  NULL,
  kontak           VARCHAR(150)  NULL,                     -- nama PIC/kontak person
  email            VARCHAR(255)  NULL,
  keterangan       VARCHAR(255)  NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_supplier_kode (kode),
  KEY idx_supplier_nama (nama),
  KEY idx_supplier_kota (kota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS supplier;
