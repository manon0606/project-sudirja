-- ============================================================================
-- Migration: 20250101000000_admin_login.sql
-- Feature  : Admin login (backoffice-sudirja) — web_sudirja database
-- Engine   : MySQL 5.7 (CHECK constraints parsed-but-ignored → validated in app)
-- ============================================================================

-- UP ---------------------------------------------------------------------------

CREATE TABLE admins (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)   NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,           -- bcrypt, cost >= 10
  full_name     VARCHAR(100)  NOT NULL,
  role          ENUM('manajemen','superadmin') NOT NULL DEFAULT 'manajemen',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side session store. Cookie holds a random token; this table stores
-- SHA-256(token) so a database leak cannot be replayed as a valid cookie.
CREATE TABLE admin_sessions (
  id         CHAR(64)     NOT NULL,                -- hex(sha256(token))
  admin_id   INT UNSIGNED NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45)  NULL,                    -- IPv6-ready
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- explicit default: MySQL 5.7 strict mode forbids implicit zero-date
  PRIMARY KEY (id),
  KEY idx_sessions_admin (admin_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_admin
    FOREIGN KEY (admin_id) REFERENCES admins (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN -------------------------------------------------------------------------

-- DROP TABLE IF EXISTS admin_sessions;
-- DROP TABLE IF EXISTS admins;
