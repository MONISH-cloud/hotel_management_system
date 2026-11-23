-- =====================================================================
--  05_db_roles.sql  |  Database-level RBAC with native MySQL 8 roles
--  Run by scripts/setup-db.mjs as a privileged user (root).
--  Placeholders  __APP_PASSWORD__  is replaced by the setup script.
--
--  Two layers of RBAC:
--    1. Application layer -> roles / permissions / role_permissions tables
--       (queried through fn_has_permission and cached in Redis)
--    2. Engine layer      -> the CREATE ROLE / GRANT statements below
-- =====================================================================

CREATE ROLE IF NOT EXISTS 'hotel_admin', 'hotel_staff', 'hotel_guest';

-- ---- hotel_admin : everything inside the hotel schema ----------------
GRANT ALL PRIVILEGES ON maison_aurelia.* TO 'hotel_admin';

-- ---- hotel_staff : front-desk / manager operations (no DELETE, no DDL) ----
GRANT SELECT ON maison_aurelia.* TO 'hotel_staff';
GRANT INSERT, UPDATE ON maison_aurelia.reservations       TO 'hotel_staff';
GRANT INSERT, UPDATE ON maison_aurelia.guests             TO 'hotel_staff';
GRANT INSERT, UPDATE ON maison_aurelia.payments           TO 'hotel_staff';
GRANT INSERT, UPDATE ON maison_aurelia.service_orders     TO 'hotel_staff';
GRANT INSERT, UPDATE ON maison_aurelia.housekeeping_tasks TO 'hotel_staff';
GRANT UPDATE         ON maison_aurelia.rooms              TO 'hotel_staff';
GRANT INSERT         ON maison_aurelia.audit_log          TO 'hotel_staff';
GRANT EXECUTE        ON maison_aurelia.*                  TO 'hotel_staff';

-- ---- hotel_guest : read the catalogue, create/cancel own bookings ----
GRANT SELECT ON maison_aurelia.room_types          TO 'hotel_guest';
GRANT SELECT ON maison_aurelia.rooms               TO 'hotel_guest';
GRANT SELECT ON maison_aurelia.amenities           TO 'hotel_guest';
GRANT SELECT ON maison_aurelia.room_type_amenities TO 'hotel_guest';
GRANT SELECT ON maison_aurelia.services            TO 'hotel_guest';
GRANT SELECT ON maison_aurelia.v_reservation_details TO 'hotel_guest';
GRANT INSERT ON maison_aurelia.service_orders      TO 'hotel_guest';
GRANT EXECUTE ON PROCEDURE maison_aurelia.sp_create_reservation TO 'hotel_guest';
GRANT EXECUTE ON PROCEDURE maison_aurelia.sp_cancel_reservation TO 'hotel_guest';
GRANT EXECUTE ON FUNCTION  maison_aurelia.fn_room_is_available  TO 'hotel_guest';

-- ---- Application service account (used by the Next.js API) -----------
-- The '%' (any host) account is only created when setup runs with MYSQL_ALLOW_ANY_HOST=1
-- (needed when MySQL runs in Docker / WSL, where host connections arrive from the container gateway).
-- Statements mentioning @'%' are skipped otherwise, so the default is localhost-only.
CREATE USER IF NOT EXISTS 'hotel_app'@'localhost'  IDENTIFIED BY '__APP_PASSWORD__';
CREATE USER IF NOT EXISTS 'hotel_app'@'127.0.0.1'  IDENTIFIED BY '__APP_PASSWORD__';
CREATE USER IF NOT EXISTS 'hotel_app'@'%'          IDENTIFIED BY '__APP_PASSWORD__';
ALTER USER 'hotel_app'@'localhost' IDENTIFIED BY '__APP_PASSWORD__';
ALTER USER 'hotel_app'@'127.0.0.1' IDENTIFIED BY '__APP_PASSWORD__';
ALTER USER 'hotel_app'@'%'         IDENTIFIED BY '__APP_PASSWORD__';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON maison_aurelia.* TO 'hotel_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON maison_aurelia.* TO 'hotel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON maison_aurelia.* TO 'hotel_app'@'%';

-- ---- Sample database logins, one per role (for demos / DBA exercises) ----
CREATE USER IF NOT EXISTS 'db_admin'@'localhost'     IDENTIFIED BY '__APP_PASSWORD__';
CREATE USER IF NOT EXISTS 'db_frontdesk'@'localhost' IDENTIFIED BY '__APP_PASSWORD__';
CREATE USER IF NOT EXISTS 'db_guest'@'localhost'     IDENTIFIED BY '__APP_PASSWORD__';
GRANT 'hotel_admin' TO 'db_admin'@'localhost';
GRANT 'hotel_staff' TO 'db_frontdesk'@'localhost';
GRANT 'hotel_guest' TO 'db_guest'@'localhost';
SET DEFAULT ROLE 'hotel_admin' TO 'db_admin'@'localhost';
SET DEFAULT ROLE 'hotel_staff' TO 'db_frontdesk'@'localhost';
SET DEFAULT ROLE 'hotel_guest' TO 'db_guest'@'localhost';

FLUSH PRIVILEGES;
