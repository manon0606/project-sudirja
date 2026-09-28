-- ============================================================================
-- Migration: 20250107000000_admin_users_komisi.sql
-- Feature  : Admin user operasional + komisi (web_sudirja database)
-- Engine   : MySQL 5.7
-- Catatan   : "user" di sini BUKAN admin login (tabel admins), melainkan
--             pengguna operasional (kasir, kurir, dan role lain) yang punya
--             hak akses sendiri dan dapat menerima komisi dari transaksi.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

-- Pengguna operasional (kasir, kurir, dll) — terpisah dari admins.
CREATE TABLE users (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username         VARCHAR(50)   NOT NULL,
  password_hash    VARCHAR(255)  NOT NULL,                 -- bcrypt, cost >= 10
  full_name        VARCHAR(100)  NOT NULL,
  role             ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL DEFAULT 'kasir',
  phone            VARCHAR(20)   NULL,
  email            VARCHAR(255)  NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aturan komisi: berapa persen komisi per role (dari subtotal/total pesanan).
CREATE TABLE komisi_settings (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  role             ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL,
  persen_komisi    DECIMAL(5,2)  NOT NULL DEFAULT 0,       -- persen dari dasar komisi
  aktif            TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_komisi_settings_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pencatatan komisi per transaksi pesanan (untuk user yang terlibat).
CREATE TABLE komisi_transaksi (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED  NOT NULL,
  pesanan_id       INT UNSIGNED  NOT NULL,
  role             ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL,
  dasar_komisi     DECIMAL(12,2) NOT NULL,                 -- subtotal / total pesanan
  persen_komisi    DECIMAL(5,2)  NOT NULL,
  nominal_komisi   DECIMAL(12,2) NOT NULL,                 -- hasil hitung
  status           ENUM('terhitung','dibayar') NOT NULL DEFAULT 'terhitung',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_komisi_user (user_id),
  KEY idx_komisi_pesanan (pesanan_id),
  KEY idx_komisi_status (status),
  CONSTRAINT fk_komisi_user     FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_komisi_pesanan  FOREIGN KEY (pesanan_id) REFERENCES pesanan(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed aturan komisi default (aktif) — bisa diubah dari UI.
INSERT INTO komisi_settings (role, persen_komisi) VALUES
  ('kasir', 1.00),
  ('kurir', 1.00),
  ('gudang', 0.50),
  ('supervisor', 0.50),
  ('owner', 0.00);

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS komisi_transaksi;
-- DROP TABLE IF EXISTS komisi_settings;
-- DROP TABLE IF EXISTS users;
