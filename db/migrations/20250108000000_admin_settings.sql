-- ============================================================================
-- Migration: 20250108000000_admin_settings.sql
-- Feature  : Admin settings — konfigurasi API key untuk aplikasi POS
-- Engine   : MySQL 5.7
-- Catatan   : Settings berupa single-row (id = 1). API key disimpan sebagai
--             hash (sha256) + hint 4 karakter pertama agar tidak pernah
--             tersimpan plaintext di DB. Aplikasi POS hanya butuh API Key
--             (URL server tidak diperlukan — key dipakai ke server ini).
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE app_settings (
  id               TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_online        TINYINT(1)       NOT NULL DEFAULT 0,   -- mode POS online
  api_key_hash     VARCHAR(64)      NULL,                 -- sha256 hex dari key
  api_key_hint     VARCHAR(8)       NULL,                 -- "abcd…" utk tampil di UI
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_app_settings_single CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed baris default (offline, tanpa key).
INSERT INTO app_settings (id, is_online, api_key_hash, api_key_hint)
VALUES (1, 0, NULL, NULL);

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS app_settings;
