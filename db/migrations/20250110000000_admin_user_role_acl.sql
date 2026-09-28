-- ============================================================================
-- Migration: 20250110000000_admin_user_role_acl.sql
-- Feature  : Relasi admin↔user, role dinamis, ACL per-role
-- Engine   : MySQL 5.7
--
-- Desain (hasil konfirmasi flow):
--   1. Admin = akun login (username+password di admins).
--   2. Setiap admin punya 1 baris `users` terkait (FK admin_id) yang
--      menyimpan data pribadi (nama, HP, email) + role. Password TIDAK lagi
--      disimpan di users (dipindah ke admins).
--   3. Role bersifat dinamis (tabel roles) + permission per role (kolom
--      permissions = daftar kode fitur, CSV). Menambah role otomatis
--      membuat baris di komisi_settings (persen default 0).
--   4. Backfill: admin lama dibuatkan user terkait dgn role superadmin
--      (agar akses penuh yang lama tidak hilang).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

-- Role dinamis. permissions = kode fitur dipisah koma (CSV).
CREATE TABLE roles (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name             VARCHAR(50)   NOT NULL,                 -- kode role, unik
  label            VARCHAR(100)  NOT NULL,                 -- nama tampil
  permissions      TEXT          NULL,                     -- "dashboard,pesanan,..."
  is_system        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kode fitur admin (identik dgn id menu di AdminSidebar).
-- dashboard, pesanan, produk, stok, promo, user, pembelian, konsinyasi,
-- laporan, pelanggan, commerce, pemetaan, settings

INSERT INTO roles (name, label, permissions, is_system) VALUES
  ('superadmin', 'Super Admin',   'dashboard,pesanan,produk,stok,promo,user,pembelian,konsinyasi,laporan,pelanggan,commerce,pemetaan,settings', 1),
  ('supervisor', 'Supervisor',    'dashboard,pesanan,produk,stok,promo,user,pembelian,konsinyasi,laporan,pelanggan,commerce,pemetaan', 1),
  ('kasir',      'Kasir',         'pesanan,commerce', 1),
  ('kurir',      'Kurir',         'pesanan', 1),
  ('gudang',     'Gudang',        'produk,stok', 1),
  ('owner',      'Owner',         'dashboard,pesanan,produk,stok,promo,user,pembelian,konsinyasi,laporan,pelanggan,commerce,pemetaan', 1);

-- Relasi users → admins (1 admin = 1 user profil). Password tidak lagi di users.
ALTER TABLE users
  ADD COLUMN admin_id INT UNSIGNED NULL AFTER id,
  DROP COLUMN password_hash,
  MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'kasir',
  ADD UNIQUE KEY uq_users_admin (admin_id),
  ADD CONSTRAINT fk_users_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;

-- admins.role: ENUM → VARCHAR (nilai lama 'manajemen' dimigrasi ke 'superadmin'
-- di backfill; role sebenarnya kini dibaca dari users terkait).
ALTER TABLE admins
  MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'superadmin';

-- komisi_settings & komisi_transaksi: role ENUM → VARCHAR (role dinamis).
ALTER TABLE komisi_settings
  MODIFY COLUMN role VARCHAR(50) NOT NULL;
ALTER TABLE komisi_transaksi
  MODIFY COLUMN role VARCHAR(50) NOT NULL;

-- Backfill: admin lama → user terkait (role superadmin agar akses penuh tetap).
INSERT INTO users (admin_id, username, full_name, role, phone, email, is_active)
SELECT a.id, a.username, a.full_name, 'superadmin', NULL, a.email, a.is_active
FROM admins a
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = a.username OR u.admin_id = a.id);

-- Trigger: role baru otomatis mendapat baris di komisi_settings (persen 0).
DELIMITER $$
CREATE TRIGGER trg_roles_after_insert
AFTER INSERT ON roles
FOR EACH ROW
BEGIN
  INSERT IGNORE INTO komisi_settings (role, persen_komisi, aktif)
  VALUES (NEW.name, 0.00, 1);
END$$
DELIMITER ;

-- DOWN -------------------------------------------------------------------------
-- Hati-hati: migrasi ke bawah akan menghapus kolom relasi & mengembalikan enum.
-- ALTER TABLE users DROP FOREIGN KEY fk_users_admin;
-- ALTER TABLE users DROP COLUMN admin_id, ADD COLUMN password_hash VARCHAR(255) NULL AFTER username,
--   MODIFY COLUMN role ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL DEFAULT 'kasir';
-- ALTER TABLE admins MODIFY COLUMN role ENUM('manajemen','superadmin') NOT NULL DEFAULT 'manajemen';
-- ALTER TABLE komisi_settings MODIFY COLUMN role ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL;
-- ALTER TABLE komisi_transaksi MODIFY COLUMN role ENUM('kasir','kurir','gudang','supervisor','owner') NOT NULL;
-- DROP TABLE IF EXISTS roles;
