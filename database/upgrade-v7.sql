-- v7: two-stage extraction queue, exact-keyword searches, richer business details.
-- migrate.mjs applies the ALTERs only when a column is missing, so this is safe to re-run.

ALTER TABLE lead_extractions ADD COLUMN current_query VARCHAR(400) NULL;
ALTER TABLE lead_extractions ADD COLUMN discovery_done TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE lead_extractions ADD COLUMN end_reached TINYINT(1) NULL;
ALTER TABLE lead_extractions ADD COLUMN coverage_note TEXT NULL;
ALTER TABLE lead_extractions MODIFY COLUMN city VARCHAR(150) NULL;
ALTER TABLE lead_extractions MODIFY COLUMN max_results INT NULL;

ALTER TABLE crm_leads ADD COLUMN place_id VARCHAR(200) NULL;
ALTER TABLE crm_leads ADD COLUMN rating DECIMAL(3,1) NULL;
ALTER TABLE crm_leads ADD COLUMN reviews_count INT NULL;
ALTER TABLE crm_leads ADD COLUMN open_status VARCHAR(200) NULL;
ALTER TABLE crm_leads ADD COLUMN opening_hours TEXT NULL;
ALTER TABLE crm_leads ADD COLUMN latitude DOUBLE NULL;
ALTER TABLE crm_leads ADD COLUMN longitude DOUBLE NULL;

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
