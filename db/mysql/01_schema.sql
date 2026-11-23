-- =====================================================================
--  MAISON AURELIA - HOTEL MANAGEMENT SYSTEM
--  01_schema.sql  |  DDL: database, tables, keys, constraints, indexes
--  Engine: MySQL 8.x (InnoDB)  |  Normal form: 3NF
-- =====================================================================

DROP DATABASE IF EXISTS maison_aurelia;
CREATE DATABASE maison_aurelia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE maison_aurelia;

-- ---------------------------------------------------------------------
-- 1. ACCESS CONTROL (role-based access control stored in the database)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  role_id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name    VARCHAR(30)  NOT NULL,
  description  VARCHAR(255) NOT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  permission_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(60)  NOT NULL,
  description   VARCHAR(255) NOT NULL,
  PRIMARY KEY (permission_id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB;

-- Many-to-many bridge: which role holds which permission
CREATE TABLE role_permissions (
  role_id       TINYINT UNSIGNED  NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id)
    REFERENCES roles (role_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id)
    REFERENCES permissions (permission_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id        TINYINT UNSIGNED NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,           -- bcrypt hash, never plain text
  full_name      VARCHAR(100) NOT NULL,
  phone          VARCHAR(20)  NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  DATETIME     NULL,
  email_verified_at DATETIME  NULL,                 -- NULL = address not verified yet
  is_demo        BOOLEAN      NOT NULL DEFAULT FALSE,  -- shown as a quick-login button when demo mode is on
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id)
    REFERENCES roles (role_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. PEOPLE: guests and employees
-- ---------------------------------------------------------------------
CREATE TABLE guests (
  guest_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,                -- NULL = walk-in guest without an online account
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  phone          VARCHAR(20)  NULL,
  country        VARCHAR(60)  NOT NULL DEFAULT 'India',
  loyalty_tier   ENUM('Silver','Gold','Platinum') NOT NULL DEFAULT 'Silver',
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guest_id),
  UNIQUE KEY uq_guests_email (email),
  UNIQUE KEY uq_guests_user (user_id),
  CONSTRAINT fk_guests_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE departments (
  department_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(60) NOT NULL,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

CREATE TABLE employees (
  employee_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL,
  department_id SMALLINT UNSIGNED NOT NULL,
  manager_id    INT UNSIGNED NULL,                 -- self-reference => reporting hierarchy
  full_name     VARCHAR(100) NOT NULL,
  job_title     VARCHAR(80)  NOT NULL,
  hire_date     DATE         NOT NULL,
  monthly_salary DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (employee_id),
  UNIQUE KEY uq_employees_user (user_id),
  KEY idx_emp_department (department_id),
  KEY idx_emp_manager (manager_id),
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_emp_department FOREIGN KEY (department_id)
    REFERENCES departments (department_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id)
    REFERENCES employees (employee_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_emp_salary CHECK (monthly_salary > 0)
  -- NOTE: "an employee cannot be their own manager" is enforced by trigger trg_emp_bu
  -- because MySQL forbids CHECK constraints on columns used in FK referential actions.
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. INVENTORY: room types, rooms, amenities
-- ---------------------------------------------------------------------
CREATE TABLE room_types (
  type_id       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug          VARCHAR(60)  NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  tagline       VARCHAR(160) NOT NULL,
  description   TEXT         NOT NULL,
  base_price    DECIMAL(10,2) NOT NULL,            -- per night, before tax
  max_adults    TINYINT UNSIGNED NOT NULL,
  max_children  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  size_sqm      SMALLINT UNSIGNED NOT NULL,
  bed_type      VARCHAR(40)  NOT NULL,
  view_type     VARCHAR(40)  NOT NULL,
  image_url     VARCHAR(400) NOT NULL,
  PRIMARY KEY (type_id),
  UNIQUE KEY uq_room_types_slug (slug),
  UNIQUE KEY uq_room_types_name (name),
  CONSTRAINT chk_rt_price CHECK (base_price > 0),
  CONSTRAINT chk_rt_adults CHECK (max_adults BETWEEN 1 AND 8),
  CONSTRAINT chk_rt_size CHECK (size_sqm > 10)
) ENGINE=InnoDB;

CREATE TABLE rooms (
  room_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_id     SMALLINT UNSIGNED NOT NULL,
  room_number VARCHAR(10) NOT NULL,
  floor_no    TINYINT UNSIGNED NOT NULL,
  status      ENUM('available','occupied','cleaning','maintenance') NOT NULL DEFAULT 'available',
  PRIMARY KEY (room_id),
  UNIQUE KEY uq_rooms_number (room_number),
  KEY idx_rooms_type_status (type_id, status),
  CONSTRAINT fk_rooms_type FOREIGN KEY (type_id)
    REFERENCES room_types (type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_rooms_floor CHECK (floor_no BETWEEN 1 AND 60)
) ENGINE=InnoDB;

CREATE TABLE amenities (
  amenity_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(60) NOT NULL,
  icon       VARCHAR(30) NOT NULL,                 -- lucide icon key used by the UI
  PRIMARY KEY (amenity_id),
  UNIQUE KEY uq_amenities_name (name)
) ENGINE=InnoDB;

-- Many-to-many: room_types <-> amenities
CREATE TABLE room_type_amenities (
  type_id    SMALLINT UNSIGNED NOT NULL,
  amenity_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (type_id, amenity_id),
  CONSTRAINT fk_rta_type FOREIGN KEY (type_id)
    REFERENCES room_types (type_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rta_amenity FOREIGN KEY (amenity_id)
    REFERENCES amenities (amenity_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. BOOKING LIFECYCLE
-- ---------------------------------------------------------------------
CREATE TABLE reservations (
  reservation_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_code CHAR(10)     NOT NULL,
  guest_id         INT UNSIGNED NOT NULL,
  room_id          INT UNSIGNED NOT NULL,
  check_in         DATE NOT NULL,
  check_out        DATE NOT NULL,
  adults           TINYINT UNSIGNED NOT NULL DEFAULT 1,
  children         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status           ENUM('pending','confirmed','checked_in','checked_out','cancelled','no_show')
                   NOT NULL DEFAULT 'pending',
  nightly_rate     DECIMAL(10,2) NOT NULL,
  tax_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(12,2) NOT NULL,         -- nights * rate + tax
  special_requests VARCHAR(500) NULL,
  group_code       CHAR(10) NULL,                  -- shared by every room of a multi-room booking
  created_by       INT UNSIGNED NULL,              -- user who made the booking (guest or staff)
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_in_at    DATETIME NULL,
  checked_out_at   DATETIME NULL,
  PRIMARY KEY (reservation_id),
  UNIQUE KEY uq_res_code (reservation_code),
  KEY idx_res_guest (guest_id),
  KEY idx_res_room_dates (room_id, check_in, check_out),
  KEY idx_res_status_dates (status, check_in),
  KEY idx_res_group (group_code),
  CONSTRAINT fk_res_guest FOREIGN KEY (guest_id)
    REFERENCES guests (guest_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_res_room FOREIGN KEY (room_id)
    REFERENCES rooms (room_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_res_created_by FOREIGN KEY (created_by)
    REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_res_dates CHECK (check_out > check_in),
  CONSTRAINT chk_res_guests CHECK (adults >= 1),
  CONSTRAINT chk_res_amounts CHECK (nightly_rate > 0 AND tax_amount >= 0 AND total_amount > 0)
) ENGINE=InnoDB;

CREATE TABLE payments (
  payment_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id INT UNSIGNED NOT NULL,
  payment_type   ENUM('payment','refund') NOT NULL DEFAULT 'payment',
  method         ENUM('card','upi','cash','netbanking') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  reference      VARCHAR(24)   NOT NULL,
  paid_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_pay_reservation (reservation_id),
  CONSTRAINT fk_pay_reservation FOREIGN KEY (reservation_id)
    REFERENCES reservations (reservation_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. SERVICES (dining, spa, transport ...) ordered during a stay
-- ---------------------------------------------------------------------
CREATE TABLE services (
  service_id  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80)  NOT NULL,
  category    ENUM('dining','spa','transport','laundry','experience') NOT NULL,
  description VARCHAR(255) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (service_id),
  UNIQUE KEY uq_services_name (name),
  CONSTRAINT chk_services_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE service_orders (
  order_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id INT UNSIGNED NOT NULL,
  service_id     SMALLINT UNSIGNED NOT NULL,
  quantity       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price     DECIMAL(10,2) NOT NULL DEFAULT 0, -- snapshot of price; filled by trigger
  status         ENUM('requested','confirmed','delivered','cancelled') NOT NULL DEFAULT 'requested',
  notes          VARCHAR(255) NULL,
  ordered_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_so_reservation (reservation_id),
  KEY idx_so_service (service_id),
  CONSTRAINT fk_so_reservation FOREIGN KEY (reservation_id)
    REFERENCES reservations (reservation_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_so_service FOREIGN KEY (service_id)
    REFERENCES services (service_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_so_qty CHECK (quantity BETWEEN 1 AND 20)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. OPERATIONS: housekeeping and audit trail
-- ---------------------------------------------------------------------
CREATE TABLE housekeeping_tasks (
  task_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id      INT UNSIGNED NOT NULL,
  employee_id  INT UNSIGNED NULL,
  task_type    ENUM('checkout_clean','turndown','deep_clean','maintenance') NOT NULL,
  status       ENUM('pending','in_progress','done') NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (task_id),
  KEY idx_hk_room (room_id),
  KEY idx_hk_status (status),
  CONSTRAINT fk_hk_room FOREIGN KEY (room_id)
    REFERENCES rooms (room_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_hk_employee FOREIGN KEY (employee_id)
    REFERENCES employees (employee_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  log_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id INT UNSIGNED NULL,
  action        VARCHAR(40) NOT NULL,
  entity        VARCHAR(40) NOT NULL,
  entity_id     INT UNSIGNED NULL,
  details       JSON NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. CONFIGURATION & SITE CONTENT (everything the UI shows lives here)
-- ---------------------------------------------------------------------
CREATE TABLE hotel_settings (
  setting_key   VARCHAR(60)  NOT NULL,
  setting_value VARCHAR(1000) NOT NULL,
  value_type    ENUM('text','number','longtext') NOT NULL DEFAULT 'text',
  group_name    VARCHAR(30)  NOT NULL,
  label         VARCHAR(100) NOT NULL,
  help_text     VARCHAR(255) NULL,
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  KEY idx_settings_group (group_name, sort_order)
) ENGINE=InnoDB;

CREATE TABLE site_features (
  feature_id  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  icon        VARCHAR(30)  NOT NULL,
  title       VARCHAR(80)  NOT NULL,
  description VARCHAR(255) NOT NULL,
  sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (feature_id),
  UNIQUE KEY uq_features_title (title)
) ENGINE=InnoDB;

-- Display metadata for the service categories (services.category is the ENUM key)
CREATE TABLE service_categories (
  category   ENUM('dining','spa','transport','laundry','experience') NOT NULL,
  title      VARCHAR(80)  NOT NULL,
  tagline    VARCHAR(255) NOT NULL,
  image_url  VARCHAR(400) NULL,
  show_on_home BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (category)
) ENGINE=InnoDB;

CREATE TABLE site_media (
  media_key VARCHAR(40)  NOT NULL,
  url       VARCHAR(400) NOT NULL,
  alt       VARCHAR(160) NOT NULL DEFAULT '',
  PRIMARY KEY (media_key)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. ACCOUNT SECURITY & NOTIFICATIONS
-- ---------------------------------------------------------------------
-- One-time tokens (only the SHA-256 hash is stored, never the token itself)
CREATE TABLE user_tokens (
  token_hash CHAR(64) NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  purpose    ENUM('password_reset','email_verify') NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_tokens_user (user_id, purpose),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Every email the system sends (or would send when SMTP is not configured)
CREATE TABLE email_outbox (
  email_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  to_address VARCHAR(120) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  status     ENUM('sent','failed','not_configured') NOT NULL,
  error      VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id),
  KEY idx_outbox_created (created_at)
) ENGINE=InnoDB;
