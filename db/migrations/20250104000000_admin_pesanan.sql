-- ============================================================================
-- Migration: 20250104000000_admin_pesanan.sql
-- Feature  : Admin pesanan (web_sudirja database)
-- Engine   : MySQL 5.7 (explicit TIMESTAMP defaults for strict mode)
-- Desain   : pesanan = header transaksi; pesanan_item = baris produk per
--            pesanan; retur_pesanan + retur_item mencatat pengembalian.
--            no_pesanan & no_retur unik global (identitas tampil di UI).
--            Metode bayar disimpan sebagai teks ("Tunai", "QRIS", "Kredit —
--            Cicil 6 Bulan", dst) agar badge warna di frontend tetap bekerja.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE pesanan (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  no_pesanan       VARCHAR(30)   NOT NULL,                 -- "ORD-YYYYMMDD-NNN"
  kasir_nama       VARCHAR(100)  NOT NULL,
  kasir_username   VARCHAR(50)   NOT NULL,
  status           ENUM('Menunggu Pembayaran','Diproses','Selesai','Dibatalkan','Dikembalikan','Menunggu Konfirmasi') NOT NULL DEFAULT 'Selesai',
  metode_bayar     VARCHAR(30)   NOT NULL,                 -- 'Tunai','QRIS','Bank Transfer','Kredit — ...'
  periode_kredit   VARCHAR(30)   NULL,                     -- utk metode Kredit
  voucher          VARCHAR(20)   NULL,
  diskon_persen    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  subtotal         DECIMAL(12,2) NOT NULL,
  diskon_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL,
  uang_diterima    DECIMAL(12,2) NOT NULL DEFAULT 0,
  kembalian        DECIMAL(12,2) NOT NULL DEFAULT 0,
  catatan          VARCHAR(255)  NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pesanan_no (no_pesanan),
  KEY idx_pesanan_created (created_at),
  KEY idx_pesanan_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pesanan_item (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pesanan_id   INT UNSIGNED  NOT NULL,
  produk_id    INT UNSIGNED  NULL,      -- NULL utk item yg produknya sudah dihapus
  nama_produk  VARCHAR(200)  NOT NULL,
  qty          INT           NOT NULL,
  harga        DECIMAL(12,2) NOT NULL,
  subtotal     DECIMAL(12,2) NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_pesanan (pesanan_id),
  CONSTRAINT fk_item_pesanan FOREIGN KEY (pesanan_id)
    REFERENCES pesanan (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_item_produk FOREIGN KEY (produk_id)
    REFERENCES produk (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE retur_pesanan (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  no_retur     VARCHAR(30)   NOT NULL,                     -- "RTR-YYYYMMDD-NNN"
  pesanan_id   INT UNSIGNED  NOT NULL,
  tipe         ENUM('semua','sebagian') NOT NULL,
  alasan       VARCHAR(200)  NOT NULL,
  catatan      VARCHAR(255)  NULL,
  total_refund DECIMAL(12,2) NOT NULL,
  status       ENUM('Selesai','Diproses') NOT NULL DEFAULT 'Selesai',
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_retur_no (no_retur),
  KEY idx_retur_pesanan (pesanan_id),
  CONSTRAINT fk_retur_pesanan FOREIGN KEY (pesanan_id)
    REFERENCES pesanan (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE retur_item (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  retur_id         INT UNSIGNED  NOT NULL,
  pesanan_item_id  INT UNSIGNED  NULL,
  nama_produk      VARCHAR(200)  NOT NULL,
  qty              INT           NOT NULL,
  harga            DECIMAL(12,2) NOT NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_retur_item_retur (retur_id),
  CONSTRAINT fk_retur_item_retur FOREIGN KEY (retur_id)
    REFERENCES retur_pesanan (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS retur_item;
-- DROP TABLE IF EXISTS retur_pesanan;
-- DROP TABLE IF EXISTS pesanan_item;
-- DROP TABLE IF EXISTS pesanan;
