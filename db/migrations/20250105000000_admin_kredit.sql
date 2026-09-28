-- ============================================================================
-- Migration: 20250105000000_admin_kredit.sql
-- Feature  : Admin kredit (pembayaran angsuran pesanan kredit) — web_sudirja
-- Engine   : MySQL 5.7 (explicit TIMESTAMP defaults for strict mode)
-- Desain   : Hanya pesanan dengan metode_bayar diawali "Kredit" yg punya
--            angsuran. kredit_pembayaran mencatat tiap pembayaran; total
--            terbayar = SUM(amount) per pesanan. Status "berjalan/lunas"
--            dihitung dari total pesanan vs total terbayar (bukan kolom).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE kredit_pembayaran (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pesanan_id    INT UNSIGNED  NOT NULL,
  jumlah        DECIMAL(12,2) NOT NULL,      -- nominal angsuran yg dibayar
  dicatat_oleh  VARCHAR(100)  NOT NULL,      -- nama admin/kasir
  catatan       VARCHAR(255)  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kredit_pesanan (pesanan_id),
  CONSTRAINT fk_kredit_pesanan FOREIGN KEY (pesanan_id)
    REFERENCES pesanan (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS kredit_pembayaran;
