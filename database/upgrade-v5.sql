-- For existing installs: run `npm run db:migrate` (it applies this safely). Shown here for reference.
ALTER TABLE app_settings ADD COLUMN extraction_max_results INT NOT NULL DEFAULT 500;
ALTER TABLE app_settings ADD COLUMN extraction_email_finder TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE leads ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'manual';
ALTER TABLE leads ADD COLUMN unsubscribed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN pattern VARCHAR(40) NOT NULL DEFAULT 'consultative';
ALTER TABLE campaigns ADD COLUMN service VARCHAR(200) NULL;
ALTER TABLE campaigns ADD COLUMN objective TEXT NULL;
ALTER TABLE campaigns ADD COLUMN custom_instructions TEXT NULL;
ALTER TABLE campaign_emails ADD COLUMN subject_options JSON NULL;
