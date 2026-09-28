-- ============================================================================
-- Migration: 20250109000000_admin_ongkir.sql
-- Feature  : Admin pemetaan & ongkir (web_sudirja database)
-- Engine   : MySQL 5.7
-- Desain   : Satu tabel ongkir_kecamatan memetakan kecamatan → biaya ongkir.
--            Kode kecamatan unik (mis. "KCM001"), identitas tampil di UI.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE ongkir_kecamatan (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  kode             VARCHAR(20)   NOT NULL,                 -- "KCM001" dst
  kecamatan        VARCHAR(100)  NOT NULL,
  ongkir           INT UNSIGNED  NOT NULL DEFAULT 0,       -- nominal rupiah
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ongkir_kode (kode),
  UNIQUE KEY uq_ongkir_kecamatan (kecamatan),
  KEY idx_ongkir_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS ongkir_kecamatan;
