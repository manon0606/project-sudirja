-- ============================================================================
-- Migration: 20250113000000_pesanan_refactor_pelanggan.sql
-- Feature  : Hapus kolom duplikat data pelanggan di tabel pesanan
-- Engine   : MySQL 5.7
--
-- Alasan   : Sejak ada tabel pelanggan + FK pesanan.pelanggan_id, data
--            nama/alamat/telepon pelanggan TIDAK perlu disalin di pesanan.
--            Data pelanggan dibaca via JOIN pelanggan_id → pelanggan.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

-- (Aman utk data lama bila ada: pindahkan snapshot ke pelanggan bila pelanggan_id null.)
-- Data lama commerce yang belum punya pelanggan_id & masih pakai kolom duplikat
-- akan dibuatkan baris pelanggan (best-effort) agar relasi tetap utuh.
INSERT IGNORE INTO pelanggan (kode, nama, email, telepon, alamat, kecamatan, is_member, is_active)
SELECT CONCAT('CUST-LEGACY-', p.id), p.nama_pelanggan, NULL, p.telepon_pelanggan, p.alamat_pelanggan, NULL, 0, 1
FROM pesanan p
WHERE p.asal_pesanan = 'commerce'
  AND p.pelanggan_id IS NULL
  AND p.nama_pelanggan IS NOT NULL
  AND p.nama_pelanggan <> '';

UPDATE pesanan p
JOIN pelanggan pg ON pg.nama = p.nama_pelanggan AND pg.telepon <=> p.telepon_pelanggan
SET p.pelanggan_id = pg.id
WHERE p.asal_pesanan = 'commerce' AND p.pelanggan_id IS NULL;

-- Hapus kolom duplikat pelanggan dari pesanan.
ALTER TABLE pesanan
  DROP COLUMN nama_pelanggan,
  DROP COLUMN alamat_pelanggan,
  DROP COLUMN telepon_pelanggan,
  DROP COLUMN alamat_lengkap;

-- DOWN -------------------------------------------------------------------------
-- ALTER TABLE pesanan
--   ADD COLUMN nama_pelanggan VARCHAR(100) NULL,
--   ADD COLUMN alamat_pelanggan VARCHAR(255) NULL,
--   ADD COLUMN telepon_pelanggan VARCHAR(30) NULL,
--   ADD COLUMN alamat_lengkap VARCHAR(255) NULL;
