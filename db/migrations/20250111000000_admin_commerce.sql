-- ============================================================================
-- Migration: 20250111000000_admin_commerce.sql
-- Feature  : Admin commerce — pesanan toko online (integrasi tabel pesanan)
-- Engine   : MySQL 5.7
-- Desain   : Pesanan tetap SATU tabel. Order commerce = pesanan dgn asal='commerce'
--            + data pelanggan online + status_pengiriman + kurir (users, role kurir).
--            Order offline/POS = asal='offline', field commerce kosong.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

-- Asal pesanan: 'offline' (POS/kasir) atau 'commerce' (toko online).
ALTER TABLE pesanan
  ADD COLUMN asal_pesanan      ENUM('offline','commerce') NOT NULL DEFAULT 'offline' AFTER no_pesanan,
  -- Data pelanggan commerce
  ADD COLUMN nama_pelanggan    VARCHAR(100) NULL AFTER catatan,
  ADD COLUMN alamat_pelanggan  VARCHAR(255) NULL,
  ADD COLUMN telepon_pelanggan VARCHAR(30)  NULL,
  -- Pengiriman commerce
  ADD COLUMN status_pengiriman ENUM('Menunggu Kurir','Diantar','Selesai') NULL,
  ADD COLUMN kurir_id          INT UNSIGNED NULL,
  ADD COLUMN alamat_lengkap    VARCHAR(255) NULL,
  ADD COLUMN catatan_pengiriman VARCHAR(255) NULL,
  ADD COLUMN dikirim_at        TIMESTAMP NULL,
  ADD COLUMN selesai_at        TIMESTAMP NULL,
  ADD KEY idx_pesanan_asal (asal_pesanan),
  ADD KEY idx_pesanan_status_pengiriman (status_pengiriman),
  ADD KEY idx_pesanan_kurir (kurir_id),
  ADD CONSTRAINT fk_pesanan_kurir FOREIGN KEY (kurir_id) REFERENCES users(id) ON DELETE SET NULL;

-- Backfill: semua pesanan lama = offline.
UPDATE pesanan SET asal_pesanan = 'offline' WHERE asal_pesanan IS NULL OR asal_pesanan = '';

-- DOWN -------------------------------------------------------------------------
-- ALTER TABLE pesanan DROP FOREIGN KEY fk_pesanan_kurir;
-- ALTER TABLE pesanan DROP KEY idx_pesanan_kurir, DROP KEY idx_pesanan_status_pengiriman, DROP KEY idx_pesanan_asal;
-- ALTER TABLE pesanan DROP COLUMN asal_pesanan, DROP COLUMN nama_pelanggan, DROP COLUMN alamat_pelanggan,
--   DROP COLUMN telepon_pelanggan, DROP COLUMN status_pengiriman, DROP COLUMN kurir_id,
--   DROP COLUMN alamat_lengkap, DROP COLUMN catatan_pengiriman, DROP COLUMN dikirim_at, DROP COLUMN selesai_at;
