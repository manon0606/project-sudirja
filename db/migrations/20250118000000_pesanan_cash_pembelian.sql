-- ============================================================================
-- Migration: 20250118000000_pesanan_cash_pembelian.sql
-- Feature  : Tambah cash_in & cash_out di tabel pesanan (opsional, dari POS)
-- Engine   : MySQL 5.7
--
-- Laporan keuangan mencatat semua pemasukan & pengeluaran. POS mengirim
-- cash_in / cash_out saat transaksi pesanan (opsional); keduanya disimpan
-- per pesanan agar laporan valid & dapat dipercaya.
-- ============================================================================

-- UP ---------------------------------------------------------------------------

ALTER TABLE pesanan
  ADD COLUMN cash_in  DECIMAL(12,2) NULL AFTER kembalian,
  ADD COLUMN cash_out DECIMAL(12,2) NULL AFTER cash_in;

-- DOWN -------------------------------------------------------------------------
-- ALTER TABLE pesanan DROP COLUMN cash_in, DROP COLUMN cash_out;
