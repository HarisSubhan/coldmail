-- Origami99 — MySQL 8.0+ / MariaDB 10.6+ schema
-- Import:  mysql -u <user> -p <database> < database/schema.sql
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NULL,
  full_name VARCHAR(255) NULL,
  company VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('super_admin','user') NOT NULL,
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price_monthly_pkr DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_yearly_pkr DECIMAL(12,2) NOT NULL DEFAULT 0,
  features JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  plan_name VARCHAR(100) NOT NULL,
  price_pkr DECIMAL(12,2) NOT NULL DEFAULT 0,
  billing_cycle ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  starts_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  plan_id CHAR(36) NULL,
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  reply_module_enabled TINYINT(1) NOT NULL DEFAULT 0,
  whatsapp_number VARCHAR(30) NOT NULL DEFAULT '923377771527',
  whatsapp_message TEXT NOT NULL,
  ai_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NULL,
  business_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(500) NULL,
  custom_fields JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_lead_email (user_id, email),
  CONSTRAINT fk_leads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  niche TEXT NULL,
  audience TEXT NULL,
  offer TEXT NULL,
  selling_points TEXT NULL,
  purpose TEXT NULL,
  keywords JSON NOT NULL,
  language VARCHAR(50) NOT NULL DEFAULT 'English',
  tone VARCHAR(50) NOT NULL DEFAULT 'Professional',
  length VARCHAR(20) NOT NULL DEFAULT 'Medium',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_campaigns_user (user_id),
  CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_emails (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  campaign_id CHAR(36) NOT NULL,
  lead_id CHAR(36) NOT NULL,
  subject TEXT NOT NULL,
  body MEDIUMTEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  attempts INT NOT NULL DEFAULT 0,
  error TEXT NULL,
  sent_at DATETIME(3) NULL,
  is_followup TINYINT(1) NOT NULL DEFAULT 0,
  followup_of CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_email_lead (campaign_id, lead_id, is_followup),
  KEY idx_ce_status (campaign_id, status),
  CONSTRAINT fk_ce_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_followup FOREIGN KEY (followup_of) REFERENCES campaign_emails(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS smtp_settings (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  sender_name VARCHAR(255) NOT NULL DEFAULT '',
  sender_email VARCHAR(255) NOT NULL DEFAULT '',
  host VARCHAR(255) NOT NULL DEFAULT '',
  port INT NOT NULL DEFAULT 587,
  username VARCHAR(255) NOT NULL DEFAULT '',
  password_encrypted TEXT NULL,
  encryption VARCHAR(10) NOT NULL DEFAULT 'tls',
  reply_to VARCHAR(255) NULL,
  signature MEDIUMTEXT NULL,
  signature_template VARCHAR(50) NULL,
  signature_data JSON NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_smtp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  campaign_id CHAR(36) NULL,
  email_id CHAR(36) NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_logs_campaign (campaign_id),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_email FOREIGN KEY (email_id) REFERENCES campaign_emails(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS replies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  campaign_id CHAR(36) NULL,
  lead_id CHAR(36) NULL,
  from_email VARCHAR(255) NOT NULL,
  subject TEXT NULL,
  body MEDIUMTEXT NULL,
  classification VARCHAR(50) NULL,
  suggested_response MEDIUMTEXT NULL,
  responded TINYINT(1) NOT NULL DEFAULT 0,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_replies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_replies_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT fk_replies_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data ---------------------------------------------------------------
INSERT IGNORE INTO app_settings (id, whatsapp_message) VALUES
  (1, 'Hi Origami99, I''d like to subscribe to the {plan} plan ({cycle}, PKR {price}). My name is {name} and my email is {email}.');

INSERT IGNORE INTO plans (id, name, description, price_monthly_pkr, price_yearly_pkr, features, sort_order) VALUES
  ('5f1c2b8a-0001-4c00-9000-000000000001', 'Starter', 'For solo outreach getting started.', 5000, 50000, '["AI email generation","CSV & Excel lead import","Own SMTP sending","Email signature designer"]', 1),
  ('5f1c2b8a-0001-4c00-9000-000000000002', 'Growth', 'For teams scaling their outreach.', 12000, 120000, '["Everything in Starter","AI follow-up emails","Reply tracking & AI suggestions","Priority support"]', 2),
  ('5f1c2b8a-0001-4c00-9000-000000000003', 'Agency', 'For agencies running many campaigns.', 25000, 250000, '["Everything in Growth","Multiple campaigns at once","Dedicated onboarding","WhatsApp priority line"]', 3);
