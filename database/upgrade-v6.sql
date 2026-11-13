CREATE TABLE IF NOT EXISTS activity_logs (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, actor_id CHAR(36) NULL,
 module VARCHAR(60) NOT NULL, activity_type VARCHAR(80) NOT NULL,
 description VARCHAR(255) NOT NULL, related_record_id CHAR(36) NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'success', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_audit_user_time(user_id,created_at), KEY idx_audit_time(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
