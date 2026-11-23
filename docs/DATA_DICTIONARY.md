# Data Dictionary

> Generated from the live `maison_aurelia` database by `npm run docs:dictionary` — types, keys, defaults and constraints are read from MySQL, so they always match the schema.

**23 tables · 189 columns.** Legend: **PK** primary key · **FK** foreign key · **UQ** unique · **Null** = may be NULL.

## Tables

- [`amenities`](#amenities) — Catalogue of in-room amenities.
- [`audit_log`](#audit_log) — Immutable trail of who changed what, written by triggers and procedures.
- [`departments`](#departments) — Hotel departments employees belong to.
- [`email_outbox`](#email_outbox) — Every email the system sends, or would send when SMTP is not configured.
- [`employees`](#employees) — Staff records (HR data), with a self-referencing reporting line.
- [`guests`](#guests) — Guest profiles; may belong to a user account or be a walk-in.
- [`hotel_settings`](#hotel_settings) — Key/value configuration: policies, loyalty rules and website copy.
- [`housekeeping_tasks`](#housekeeping_tasks) — Cleaning and maintenance jobs per room.
- [`payments`](#payments) — Money received or refunded against a reservation.
- [`permissions`](#permissions) — Every action the system can authorise, e.g. reservations.manage.
- [`reservations`](#reservations) — One booked room for a date range; the core transactional table.
- [`role_permissions`](#role_permissions) — Bridge table: which role holds which permission (many-to-many).
- [`roles`](#roles) — The job roles an account can hold (admin, manager, receptionist, guest).
- [`room_type_amenities`](#room_type_amenities) — Bridge table: amenities offered by each room type (many-to-many).
- [`room_types`](#room_types) — Room categories with price, capacity and marketing details.
- [`rooms`](#rooms) — Physical rooms; each belongs to one room type.
- [`service_categories`](#service_categories) — Display metadata for service categories.
- [`service_orders`](#service_orders) — Services ordered by a guest during a stay (added to the folio).
- [`services`](#services) — Catalogue of orderable services (dining, spa, transport…).
- [`site_features`](#site_features) — Feature blurbs shown under the home-page hero.
- [`site_media`](#site_media) — Named images used by the website (hero, story, login panel).
- [`user_tokens`](#user_tokens) — One-time tokens for password reset and email verification.
- [`users`](#users) — Login accounts for guests and staff.

## amenities

Catalogue of in-room amenities.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `amenity_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `name` | varchar(60) | no | UQ |  | Unique amenity name. |
| `icon` | varchar(30) | no |  |  | Icon key used by the UI. |

## audit_log

Immutable trail of who changed what, written by triggers and procedures.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `log_id` | bigint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `actor_user_id` | int unsigned | yes |  | NULL | User who acted (from @app_user_id); NULL = system. |
| `action` | varchar(40) | no |  |  | Event name, e.g. reservation.created. |
| `entity` | varchar(40) | no |  |  | Kind of object affected. |
| `entity_id` | int unsigned | yes |  | NULL | Primary key of the affected object. |
| `details` | json | yes |  | NULL | JSON with event-specific data. |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | When it happened. |

**Constraints & indexes**

- **INDEX** `idx_audit_action` on (action,created_at)
- **INDEX** `idx_audit_created` on (created_at)
- **INDEX** `idx_audit_entity` on (entity,entity_id)

## departments

Hotel departments employees belong to.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `department_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `name` | varchar(60) | no | UQ |  | Unique department name. |

## email_outbox

Every email the system sends, or would send when SMTP is not configured.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `email_id` | bigint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `to_address` | varchar(120) | no |  |  | Recipient. |
| `subject` | varchar(200) | no |  |  | Subject line. |
| `body` | text | no |  |  | Plain-text message. |
| `status` | enum('sent','failed','not_configured') | no |  |  | sent, failed or not_configured. |
| `error` | varchar(255) | yes |  | NULL | Delivery error message, if any. |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | When it was queued. |

**Constraints & indexes**

- **INDEX** `idx_outbox_created` on (created_at)

## employees

Staff records (HR data), with a self-referencing reporting line.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `employee_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `user_id` | int unsigned | yes | FK → users.user_id, UQ | NULL | Optional login account of the employee (FK → users). |
| `department_id` | smallint unsigned | no | FK → departments.department_id |  | Department (FK → departments). |
| `manager_id` | int unsigned | yes | FK → employees.employee_id | NULL | Direct manager (self-reference FK → employees); NULL for the top of the hierarchy. |
| `full_name` | varchar(100) | no |  |  | Employee name. |
| `job_title` | varchar(80) | no |  |  | Position held. |
| `hire_date` | date | no |  |  | Date of joining. |
| `monthly_salary` | decimal(10,2) | no |  |  | Gross monthly salary in rupees; must be positive. |

**Constraints & indexes**

- **FK** `fk_emp_department`: `department_id` → `departments.department_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **FK** `fk_emp_manager`: `manager_id` → `employees.employee_id` (ON DELETE SET NULL, ON UPDATE CASCADE)
- **FK** `fk_emp_user`: `user_id` → `users.user_id` (ON DELETE SET NULL, ON UPDATE CASCADE)
- **CHECK** `chk_emp_salary`: `(`monthly_salary` > 0)`
- **INDEX** `idx_emp_department` on (department_id)
- **INDEX** `idx_emp_manager` on (manager_id)

## guests

Guest profiles; may belong to a user account or be a walk-in.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `guest_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `user_id` | int unsigned | yes | FK → users.user_id, UQ | NULL | Linked login account; NULL for walk-in guests (FK → users). |
| `full_name` | varchar(100) | no |  |  | Guest’s full name. |
| `email` | varchar(120) | no | UQ |  | Unique contact email. |
| `phone` | varchar(20) | yes |  | NULL | Contact number. |
| `country` | varchar(60) | no |  | 'India' | Country of residence. |
| `loyalty_tier` | enum('Silver','Gold','Platinum') | no |  | 'Silver' | Silver, Gold or Platinum; derived from points by fn_loyalty_tier. |
| `loyalty_points` | int unsigned | no |  | '0' | Points earned at check-out (1 per configured number of rupees). |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | Profile creation time. |

**Constraints & indexes**

- **FK** `fk_guests_user`: `user_id` → `users.user_id` (ON DELETE SET NULL, ON UPDATE CASCADE)
- **CHECK** `chk_guests_name`: `(char_length(trim(`full_name`)) >= 2)`

## hotel_settings

Key/value configuration: policies, loyalty rules and website copy.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `setting_key` | varchar(60) | no | PK |  | Primary key, e.g. tax_rate_pct. |
| `setting_value` | varchar(1000) | no |  |  | The value (text or number stored as text). |
| `value_type` | enum('text','number','longtext') | no |  | 'text' | text, number or longtext; drives validation and the editor. |
| `group_name` | varchar(30) | no |  |  | Section shown in the Settings screen. |
| `label` | varchar(100) | no |  |  | Human label. |
| `help_text` | varchar(255) | yes |  | NULL | Short help shown under the field. |
| `sort_order` | smallint unsigned | no |  | '0' | Order within the group. |
| `updated_at` | datetime | no |  | CURRENT_TIMESTAMP | Last change time. |

**Constraints & indexes**

- **INDEX** `idx_settings_group` on (group_name,sort_order)

## housekeeping_tasks

Cleaning and maintenance jobs per room.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `task_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `room_id` | int unsigned | no | FK → rooms.room_id |  | Room to service (FK → rooms). |
| `employee_id` | int unsigned | yes | FK → employees.employee_id | NULL | Assigned employee (FK → employees); NULL = unassigned. |
| `task_type` | enum('checkout_clean','turndown','deep_clean','maintenance') | no |  |  | checkout_clean, turndown, deep_clean or maintenance. |
| `status` | enum('pending','in_progress','done') | no |  | 'pending' | pending, in_progress or done. |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | When the task was created. |
| `completed_at` | datetime | yes |  | NULL | When it was finished; completing a clean frees the room (trigger). |

**Constraints & indexes**

- **FK** `fk_hk_employee`: `employee_id` → `employees.employee_id` (ON DELETE SET NULL, ON UPDATE CASCADE)
- **FK** `fk_hk_room`: `room_id` → `rooms.room_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- **INDEX** `idx_hk_room` on (room_id)
- **INDEX** `idx_hk_status` on (status)

## payments

Money received or refunded against a reservation.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `payment_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `reservation_id` | int unsigned | no | FK → reservations.reservation_id |  | Reservation paid (FK → reservations). |
| `payment_type` | enum('payment','refund') | no |  | 'payment' | payment or refund. |
| `method` | enum('card','upi','cash','netbanking') | no |  |  | card, upi, cash or netbanking. |
| `amount` | decimal(12,2) | no |  |  | Positive amount in rupees (CHECK > 0). |
| `reference` | varchar(24) | no | UQ |  | Unique payment/refund reference. |
| `paid_at` | datetime | no |  | CURRENT_TIMESTAMP | When it was recorded. |

**Constraints & indexes**

- **FK** `fk_pay_reservation`: `reservation_id` → `reservations.reservation_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **CHECK** `chk_pay_amount`: `(`amount` > 0)`
- **INDEX** `idx_pay_paid_at` on (paid_at)
- **INDEX** `idx_pay_reservation` on (reservation_id)

## permissions

Every action the system can authorise, e.g. reservations.manage.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `permission_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `code` | varchar(60) | no | UQ |  | Unique machine-readable permission code checked by the API. |
| `description` | varchar(255) | no |  |  | Plain-language meaning of the permission. |

## reservations

One booked room for a date range; the core transactional table.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `reservation_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `reservation_code` | char(10) | no | UQ |  | Unique customer-facing booking reference. |
| `guest_id` | int unsigned | no | FK → guests.guest_id |  | Booking guest (FK → guests). |
| `room_id` | int unsigned | no | FK → rooms.room_id |  | Assigned room (FK → rooms). |
| `check_in` | date | no |  |  | Arrival date. |
| `check_out` | date | no |  |  | Departure date; CHECK ensures it is after check_in. |
| `adults` | tinyint unsigned | no |  | '1' | Adults staying (≥ 1). |
| `children` | tinyint unsigned | no |  | '0' | Children staying. |
| `status` | enum('pending','confirmed','checked_in','checked_out','cancelled','no_show') | no |  | 'pending' | pending, confirmed, checked_in, checked_out, cancelled or no_show. |
| `source` | enum('online','front_desk') | no |  | 'online' | online (guest) or front_desk (staff); set by trigger trg_res_bi. |
| `nightly_rate` | decimal(10,2) | no |  |  | Rate per night captured at booking time. |
| `tax_amount` | decimal(10,2) | no |  | '0.00' | Tax charged (rate from hotel_settings at booking time). |
| `total_amount` | decimal(12,2) | no |  |  | Nights × rate + tax. |
| `special_requests` | varchar(500) | yes |  | NULL | Free-text guest requests. |
| `group_code` | char(10) | yes |  | NULL | Shared by all rooms of one multi-room booking; NULL for single rooms. |
| `created_by` | int unsigned | yes | FK → users.user_id | NULL | User who made the booking (FK → users). |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | When the booking was made. |
| `checked_in_at` | datetime | yes |  | NULL | Actual check-in time. |
| `checked_out_at` | datetime | yes |  | NULL | Actual check-out time. |

**Constraints & indexes**

- **FK** `fk_res_created_by`: `created_by` → `users.user_id` (ON DELETE SET NULL, ON UPDATE CASCADE)
- **FK** `fk_res_guest`: `guest_id` → `guests.guest_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **FK** `fk_res_room`: `room_id` → `rooms.room_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **CHECK** `chk_res_amounts`: `((`nightly_rate` > 0) and (`tax_amount` >= 0) and (`total_amount` > 0))`
- **CHECK** `chk_res_dates`: `(`check_out` > `check_in`)`
- **CHECK** `chk_res_guests`: `(`adults` >= 1)`
- **INDEX** `idx_res_group` on (group_code)
- **INDEX** `idx_res_guest` on (guest_id)
- **INDEX** `idx_res_room_dates` on (room_id,check_in,check_out)
- **INDEX** `idx_res_status_dates` on (status,check_in)

## role_permissions

Bridge table: which role holds which permission (many-to-many).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `role_id` | tinyint unsigned | no | PK, FK → roles.role_id |  | Role that receives the permission (FK → roles). |
| `permission_id` | smallint unsigned | no | PK, FK → permissions.permission_id |  | Permission granted (FK → permissions). |

**Constraints & indexes**

- **FK** `fk_rp_permission`: `permission_id` → `permissions.permission_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- **FK** `fk_rp_role`: `role_id` → `roles.role_id` (ON DELETE CASCADE, ON UPDATE CASCADE)

## roles

The job roles an account can hold (admin, manager, receptionist, guest).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `role_id` | tinyint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `role_name` | varchar(30) | no | UQ |  | Short unique role name used in code and the JWT. |
| `description` | varchar(255) | no |  |  | What the role is for. |

## room_type_amenities

Bridge table: amenities offered by each room type (many-to-many).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `type_id` | smallint unsigned | no | PK, FK → room_types.type_id |  | Room type (FK → room_types). |
| `amenity_id` | smallint unsigned | no | PK, FK → amenities.amenity_id |  | Amenity (FK → amenities). |

**Constraints & indexes**

- **FK** `fk_rta_amenity`: `amenity_id` → `amenities.amenity_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- **FK** `fk_rta_type`: `type_id` → `room_types.type_id` (ON DELETE CASCADE, ON UPDATE CASCADE)

## room_types

Room categories with price, capacity and marketing details.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `type_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `slug` | varchar(60) | no | UQ |  | URL-safe unique identifier used in /rooms/{slug}. |
| `name` | varchar(80) | no | UQ |  | Unique display name. |
| `tagline` | varchar(160) | no |  |  | One-line summary. |
| `description` | text | no |  |  | Long marketing description. |
| `base_price` | decimal(10,2) | no |  |  | Price per night before tax, in rupees (CHECK > 0). |
| `max_adults` | tinyint unsigned | no |  |  | Adults the room sleeps (1–8). |
| `max_children` | tinyint unsigned | no |  | '0' | Children the room sleeps. |
| `size_sqm` | smallint unsigned | no |  |  | Floor area in square metres (CHECK > 10). |
| `bed_type` | varchar(40) | no |  |  | Bedding description. |
| `view_type` | varchar(60) | no |  |  | View from the room. |
| `image_url` | varchar(400) | no |  |  | Photo: an https URL or an uploaded file under /api/media. |

**Constraints & indexes**

- **CHECK** `chk_rt_adults`: `(`max_adults` between 1 and 8)`
- **CHECK** `chk_rt_price`: `(`base_price` > 0)`
- **CHECK** `chk_rt_size`: `(`size_sqm` > 10)`

## rooms

Physical rooms; each belongs to one room type.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `room_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `type_id` | smallint unsigned | no | FK → room_types.type_id |  | Category of the room (FK → room_types). |
| `room_number` | varchar(10) | no | UQ |  | Unique number shown to guests and staff. |
| `floor_no` | tinyint unsigned | no |  |  | Floor (1–60). |
| `status` | enum('available','occupied','cleaning','maintenance') | no |  | 'available' | available, occupied, cleaning or maintenance; kept in sync by triggers. |

**Constraints & indexes**

- **FK** `fk_rooms_type`: `type_id` → `room_types.type_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **CHECK** `chk_rooms_floor`: `(`floor_no` between 1 and 60)`
- **INDEX** `idx_rooms_type_status` on (type_id,status)

## service_categories

Display metadata for service categories.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `category` | enum('dining','spa','transport','laundry','experience') | no | PK |  | Primary key; same values as services.category. |
| `title` | varchar(80) | no |  |  | Heading on the home page. |
| `tagline` | varchar(255) | no |  |  | Short description. |
| `image_url` | varchar(400) | yes |  | NULL | Tile photo. |
| `show_on_home` | tinyint(1) | no |  | '1' | Whether it appears on the home page. |
| `sort_order` | smallint unsigned | no |  | '0' | Display order. |

## service_orders

Services ordered by a guest during a stay (added to the folio).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `order_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `reservation_id` | int unsigned | no | FK → reservations.reservation_id |  | Stay the order belongs to (FK → reservations). |
| `service_id` | smallint unsigned | no | FK → services.service_id |  | Service ordered (FK → services). |
| `quantity` | tinyint unsigned | no |  | '1' | Units ordered (1–20). |
| `unit_price` | decimal(10,2) | no |  | '0.00' | Price snapshot taken by trigger trg_so_bi. |
| `status` | enum('requested','confirmed','delivered','cancelled') | no |  | 'requested' | requested, confirmed, delivered or cancelled. |
| `notes` | varchar(255) | yes |  | NULL | Guest instructions. |
| `ordered_at` | datetime | no |  | CURRENT_TIMESTAMP | When it was requested. |

**Constraints & indexes**

- **FK** `fk_so_reservation`: `reservation_id` → `reservations.reservation_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- **FK** `fk_so_service`: `service_id` → `services.service_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **CHECK** `chk_so_qty`: `(`quantity` between 1 and 20)`
- **INDEX** `idx_so_reservation` on (reservation_id)
- **INDEX** `idx_so_service` on (service_id)

## services

Catalogue of orderable services (dining, spa, transport…).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `service_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `name` | varchar(80) | no | UQ |  | Unique service name. |
| `category` | enum('dining','spa','transport','laundry','experience') | no |  |  | dining, spa, transport, laundry or experience. |
| `description` | varchar(255) | no |  |  | What the service includes. |
| `price` | decimal(10,2) | no |  |  | Current price in rupees (≥ 0). |
| `is_active` | tinyint(1) | no |  | '1' | FALSE hides it from guests without deleting history. |

**Constraints & indexes**

- **CHECK** `chk_services_price`: `(`price` >= 0)`

## site_features

Feature blurbs shown under the home-page hero.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `feature_id` | smallint unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `icon` | varchar(30) | no |  |  | Icon key. |
| `title` | varchar(80) | no | UQ |  | Unique heading. |
| `description` | varchar(255) | no |  |  | Text; may contain {placeholders} filled from settings. |
| `sort_order` | smallint unsigned | no |  | '0' | Display order. |

## site_media

Named images used by the website (hero, story, login panel).

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `media_key` | varchar(40) | no | PK |  | Primary key, e.g. hero. |
| `url` | varchar(400) | no |  |  | Image URL. |
| `alt` | varchar(160) | no |  | '' | Alt text for accessibility. |

## user_tokens

One-time tokens for password reset and email verification.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `token_hash` | char(64) | no | PK |  | SHA-256 of the token (the token itself is only in the email). |
| `user_id` | int unsigned | no | FK → users.user_id |  | Owner (FK → users). |
| `purpose` | enum('password_reset','email_verify') | no |  |  | password_reset or email_verify. |
| `expires_at` | datetime | no |  |  | Token is invalid after this time. |
| `used_at` | datetime | yes |  | NULL | Set when consumed; NULL = still usable. |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | Issue time. |

**Constraints & indexes**

- **FK** `fk_tokens_user`: `user_id` → `users.user_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- **INDEX** `idx_tokens_user` on (user_id,purpose)

## users

Login accounts for guests and staff.

| Column | Type | Null | Key | Default | Description |
|---|---|---|---|---|---|
| `user_id` | int unsigned AUTO_INCREMENT | no | PK |  | Surrogate primary key. |
| `role_id` | tinyint unsigned | no | FK → roles.role_id |  | The account’s single role (FK → roles). |
| `email` | varchar(120) | no | UQ |  | Login name; unique, validated by a CHECK. |
| `password_hash` | varchar(100) | no |  |  | bcrypt hash of the password; the plain password is never stored. |
| `full_name` | varchar(100) | no |  |  | Display name (at least 2 characters). |
| `phone` | varchar(20) | yes |  | NULL | Optional contact number. |
| `is_active` | tinyint(1) | no |  | '1' | FALSE disables the account; fn_has_permission then denies everything. |
| `last_login_at` | datetime | yes |  | NULL | Time of the most recent successful sign-in. |
| `email_verified_at` | datetime | yes |  | NULL | When the email address was confirmed; NULL = not verified. |
| `is_demo` | tinyint(1) | no |  | '0' | TRUE for demo accounts shown as quick-login buttons. |
| `created_at` | datetime | no |  | CURRENT_TIMESTAMP | When the account was created. |

**Constraints & indexes**

- **FK** `fk_users_role`: `role_id` → `roles.role_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- **CHECK** `chk_users_email`: `(`email` like _utf8mb4\'%_@_%._%\')`
- **CHECK** `chk_users_name`: `(char_length(trim(`full_name`)) >= 2)`
- **INDEX** `idx_users_role` on (role_id)

## Views

- `v_guest_value`
- `v_reservation_details`

`v_reservation_details` joins reservations, guests, rooms and room types and adds computed nights, services total and balance due. `v_guest_value` aggregates stays and spend per guest.
