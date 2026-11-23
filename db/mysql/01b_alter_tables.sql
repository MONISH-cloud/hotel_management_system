-- =====================================================================
--  01b_alter_tables.sql  |  DDL: ALTER TABLE (schema evolution, "release 1.1")
--  Runs after 01_schema.sql and before the routines, so the triggers and
--  views in 02_routines.sql can use what is added here.
-- =====================================================================
USE maison_aurelia;

-- 1) ADD COLUMN: record how a booking was made (online by the guest, or by front-desk staff).
--    The value is filled automatically by trigger trg_res_bi using fn_has_permission().
ALTER TABLE reservations
  ADD COLUMN source ENUM('online','front_desk') NOT NULL DEFAULT 'online' AFTER status;

-- 2) ADD INDEX: the audit page filters by action and the dashboard sums payments by date.
ALTER TABLE audit_log ADD INDEX idx_audit_action (action, created_at);
ALTER TABLE payments  ADD INDEX idx_pay_paid_at (paid_at);

-- 3) ADD CONSTRAINT: a person's name must contain at least two non-blank characters.
ALTER TABLE users  ADD CONSTRAINT chk_users_name  CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2);
ALTER TABLE guests ADD CONSTRAINT chk_guests_name CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2);

-- 4) MODIFY COLUMN: room "view" descriptions outgrew VARCHAR(40) ("Panoramic city & mountain view" etc.).
ALTER TABLE room_types MODIFY COLUMN view_type VARCHAR(60) NOT NULL;
