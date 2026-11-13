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

-- ===== Upgrade: Lead Finder + CRM (v5) =====
CREATE TABLE IF NOT EXISTS lead_extractions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(150) NULL,
  category VARCHAR(200) NULL,
  area_codes JSON NOT NULL,
  max_results INT NULL,
  find_emails TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_area VARCHAR(60) NULL,
  current_query VARCHAR(400) NULL,
  areas_done INT NOT NULL DEFAULT 0,
  found INT NOT NULL DEFAULT 0,
  saved INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  discovery_done TINYINT(1) NOT NULL DEFAULT 0,
  end_reached TINYINT(1) NULL,
  coverage_note TEXT NULL,
  error TEXT NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ext_user (user_id, status),
  CONSTRAINT fk_ext_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_stages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_stage_user (user_id, position),
  CONSTRAINT fk_stage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  extraction_id CHAR(36) NULL,
  stage_id CHAR(36) NULL,
  lead_id CHAR(36) NULL,
  business_name VARCHAR(300) NOT NULL,
  contact_person VARCHAR(255) NULL,
  category VARCHAR(200) NULL,
  address VARCHAR(500) NULL,
  phone VARCHAR(60) NULL,
  website VARCHAR(500) NULL,
  email VARCHAR(255) NULL,
  maps_url TEXT NULL,
  place_id VARCHAR(200) NULL,
  rating DECIMAL(3,1) NULL,
  reviews_count INT NULL,
  open_status VARCHAR(200) NULL,
  opening_hours TEXT NULL,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  city VARCHAR(150) NULL,
  area_code VARCHAR(60) NULL,
  keyword VARCHAR(255) NULL,
  search_location VARCHAR(255) NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  notes TEXT NULL,
  followup_date DATE NULL,
  last_contacted_at DATETIME(3) NULL,
  unsubscribed TINYINT(1) NOT NULL DEFAULT 0,
  extracted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_crm_user (user_id, extracted_at),
  KEY idx_crm_stage (stage_id),
  CONSTRAINT fk_crm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_ext FOREIGN KEY (extraction_id) REFERENCES lead_extractions(id) ON DELETE SET NULL,
  CONSTRAINT fk_crm_stage FOREIGN KEY (stage_id) REFERENCES crm_stages(id) ON DELETE SET NULL,
  CONSTRAINT fk_crm_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS extraction_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  extraction_id CHAR(36) NOT NULL,
  place_key VARCHAR(500) NOT NULL,
  business_name VARCHAR(300) NOT NULL,
  maps_url TEXT NOT NULL,
  area VARCHAR(60) NULL,
  search_query VARCHAR(400) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  error TEXT NULL,
  crm_lead_id CHAR(36) NULL,
  has_phone TINYINT(1) NOT NULL DEFAULT 0,
  has_email TINYINT(1) NOT NULL DEFAULT 0,
  has_website TINYINT(1) NOT NULL DEFAULT 0,
  discovered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_item_place (extraction_id, place_key(255)),
  KEY idx_items_queue (extraction_id, status, discovered_at),
  CONSTRAINT fk_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_ext FOREIGN KEY (extraction_id) REFERENCES lead_extractions(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_lead FOREIGN KEY (crm_lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS extension_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_token (token_hash),
  CONSTRAINT fk_tok_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- v6 operational audit
CREATE TABLE IF NOT EXISTS activity_logs (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, actor_id CHAR(36) NULL,
 module VARCHAR(60) NOT NULL, activity_type VARCHAR(80) NOT NULL,
 description VARCHAR(255) NOT NULL, related_record_id CHAR(36) NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'success', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_audit_user_time(user_id,created_at), KEY idx_audit_time(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
