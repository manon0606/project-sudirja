-- ============================================================================
-- Migration: 20250102000000_admin_products.sql
-- Feature  : Admin produk (satuan, merk, kategori, produk + harga/kodeitem
--            per satuan) — web_sudirja database
-- Engine   : MySQL 5.7 (explicit TIMESTAMP defaults for strict mode)
-- Desain   : 1 produk dapat punya BANYAK harga & kode_item, satu per satuan
--            yang dikonfigurasi di Kelola Satuan (tabel anak produk_satuan).
--            kode_item unik GLOBAL karena barcode dipakai sebagai identitas
--            scan fisik per kemasan satuan.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE satuan (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode        VARCHAR(12)  NOT NULL,               -- "SAT-001", tampil di UI
  nama        VARCHAR(100) NOT NULL,
  jumlah_unit INT UNSIGNED NOT NULL,               -- >= 1, divalidasi di app
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_satuan_kode (kode),
  UNIQUE KEY uq_satuan_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE merk (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode       VARCHAR(12)  NOT NULL,                -- "MRK-001"
  nama       VARCHAR(100) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_merk_kode (kode),
  UNIQUE KEY uq_merk_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kategori (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode       VARCHAR(12)  NOT NULL,                -- "KAT-001"
  nama       VARCHAR(100) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kategori_kode (kode),
  UNIQUE KEY uq_kategori_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE produk (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku         VARCHAR(50)  NOT NULL,
  nama        VARCHAR(200) NOT NULL,
  deskripsi   TEXT         NULL,
  gambar_url  MEDIUMTEXT   NULL,                -- dataURL preview (JPG/PNG <= 2MB)
  kategori_id INT UNSIGNED NOT NULL,
  merk_id     INT UNSIGNED NOT NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produk_sku (sku),
  KEY idx_produk_nama (nama),
  KEY idx_produk_kategori (kategori_id),
  KEY idx_produk_merk (merk_id),
  CONSTRAINT fk_produk_kategori FOREIGN KEY (kategori_id) REFERENCES kategori (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_produk_merk FOREIGN KEY (merk_id) REFERENCES merk (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE produk_satuan (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  produk_id  INT UNSIGNED  NOT NULL,
  satuan_id  INT UNSIGNED  NOT NULL,
  kode_item  VARCHAR(64)   NOT NULL,              -- barcode identity, unik global
  harga      DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produk_satuan (produk_id, satuan_id),
  UNIQUE KEY uq_kode_item (kode_item),
  KEY idx_ps_satuan (satuan_id),
  CONSTRAINT fk_ps_produk FOREIGN KEY (produk_id) REFERENCES produk (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ps_satuan FOREIGN KEY (satuan_id) REFERENCES satuan (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS produk_satuan;
-- DROP TABLE IF EXISTS produk;
-- DROP TABLE IF EXISTS kategori;
-- DROP TABLE IF EXISTS merk;
-- DROP TABLE IF EXISTS satuan;
