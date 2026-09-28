-- Migration: admin promo
-- Promo management is intentionally separate from product tables.
CREATE TABLE promo (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode VARCHAR(50) NOT NULL,
  nama VARCHAR(200) NOT NULL,
  tipe ENUM('Diskon Ongkir','Diskon Nominal','Diskon %') NOT NULL,
  deskripsi TEXT NULL,
  nilai_diskon DECIMAL(12,2) NOT NULL,
  minimal_belanja DECIMAL(12,2) NOT NULL DEFAULT 0,
  maksimal_diskon DECIMAL(12,2) NULL,
  tanggal_mulai DATETIME NOT NULL,
  tanggal_berakhir DATETIME NOT NULL,
  batas_kuota INT UNSIGNED NOT NULL DEFAULT 0,
  jumlah_digunakan INT UNSIGNED NOT NULL DEFAULT 0,
  syarat_ketentuan JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promo_kode (kode),
  KEY idx_promo_active_period (is_active, tanggal_mulai, tanggal_berakhir),
  KEY idx_promo_tipe (tipe),
  KEY idx_promo_nama (nama),
  CONSTRAINT chk_promo_nilai CHECK (nilai_diskon > 0),
  CONSTRAINT chk_promo_minimal CHECK (minimal_belanja >= 0),
  CONSTRAINT chk_promo_periode CHECK (tanggal_berakhir >= tanggal_mulai),
  CONSTRAINT chk_promo_kuota CHECK (jumlah_digunakan <= batas_kuota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
-- DROP TABLE IF EXISTS promo;
