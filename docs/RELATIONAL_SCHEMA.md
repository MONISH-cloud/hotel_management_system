# Relational Schema

Notation: **PK** primary key · *FK* foreign key (→ referenced table) · `UQ` unique · `CK` check constraint.
The executable DDL is [`db/mysql/01_schema.sql`](../db/mysql/01_schema.sql).

```
roles(role_id PK, role_name UQ, description)
permissions(permission_id PK, code UQ, description)
role_permissions(role_id PK/FK→roles, permission_id PK/FK→permissions)
users(user_id PK, role_id FK→roles, email UQ, password_hash, full_name, phone, is_active, last_login_at, email_verified_at, is_demo, created_at)
guests(guest_id PK, user_id UQ/FK→users NULL, full_name, email UQ, phone, country, loyalty_tier, loyalty_points, created_at)
departments(department_id PK, name UQ)
employees(employee_id PK, user_id UQ/FK→users NULL, department_id FK→departments, manager_id FK→employees NULL,
          full_name, job_title, hire_date, monthly_salary)
room_types(type_id PK, slug UQ, name UQ, tagline, description, base_price, max_adults, max_children,
           size_sqm, bed_type, view_type, image_url)
rooms(room_id PK, type_id FK→room_types, room_number UQ, floor_no, status)
amenities(amenity_id PK, name UQ, icon)
room_type_amenities(type_id PK/FK→room_types, amenity_id PK/FK→amenities)
reservations(reservation_id PK, reservation_code UQ, guest_id FK→guests, room_id FK→rooms, check_in, check_out,
             adults, children, status, source, nightly_rate, tax_amount, total_amount, special_requests, group_code,
             created_by FK→users NULL, created_at, checked_in_at, checked_out_at)
payments(payment_id PK, reservation_id FK→reservations, payment_type, method, amount, reference UQ, paid_at)
services(service_id PK, name UQ, category, description, price, is_active)
service_orders(order_id PK, reservation_id FK→reservations, service_id FK→services, quantity, unit_price, status, notes, ordered_at)
housekeeping_tasks(task_id PK, room_id FK→rooms, employee_id FK→employees NULL, task_type, status, created_at, completed_at)
hotel_settings(setting_key PK, setting_value, value_type, group_name, label, help_text, sort_order, updated_at)
site_features(feature_id PK, icon, title UQ, description, sort_order)
service_categories(category PK, title, tagline, image_url, show_on_home, sort_order)
site_media(media_key PK, url, alt)
user_tokens(token_hash PK, user_id FK→users, purpose, expires_at, used_at, created_at)
email_outbox(email_id PK, to_address, subject, body, status, error, created_at)
audit_log(log_id PK, actor_user_id, action, entity, entity_id, details JSON, created_at)
```

## Referential actions

| Foreign key | ON DELETE | ON UPDATE | Rationale |
|---|---|---|---|
| `users.role_id` | RESTRICT | CASCADE | A role in use can't be deleted |
| `role_permissions.*` | CASCADE | CASCADE | Bridge rows die with either parent |
| `guests.user_id`, `employees.user_id` | SET NULL | CASCADE | Deleting an account keeps the guest history / HR record |
| `employees.manager_id` | SET NULL | CASCADE | Removing a manager re-parents reports to "no manager" |
| `rooms.type_id` | RESTRICT | CASCADE | Can't delete a type that still has rooms |
| `reservations.guest_id`, `.room_id` | RESTRICT | CASCADE | Financial history must never disappear |
| `payments.reservation_id` | RESTRICT | CASCADE | Payments are immutable accounting records |
| `service_orders.reservation_id` | CASCADE | CASCADE | Orders belong to the folio |
| `service_orders.service_id` | RESTRICT | CASCADE | An ordered service can't be deleted, only deactivated |

## Constraints beyond keys

| Table | Constraint |
|---|---|
| `users` | `CK email LIKE '%_@_%._%'` |
| `employees` | `CK monthly_salary > 0`; trigger `trg_emp_bu` forbids `manager_id = employee_id` (MySQL disallows CHECKs on FK-action columns) |
| `room_types` | `CK base_price > 0`, `max_adults BETWEEN 1 AND 8`, `size_sqm > 10` |
| `rooms` | `CK floor_no BETWEEN 1 AND 60` |
| `reservations` | `CK check_out > check_in`, `adults >= 1`, `nightly_rate > 0 AND tax_amount >= 0 AND total_amount > 0`; trigger blocks overlapping bookings & over-capacity |
| `payments` | `CK amount > 0` |
| `services` | `CK price >= 0` |
| `service_orders` | `CK quantity BETWEEN 1 AND 20` |

## Normalisation

* **1NF**: all columns atomic. Lists (amenities, permissions) are rows of bridge tables, never comma-separated values.
* **2NF**: bridge tables have composite keys whose non-key attributes (none) depend on the whole key; every other table has a single-column surrogate key.
* **3NF**: no transitive dependencies. Room-type facts (price, capacity) live in `room_types`, not in `rooms`; guest facts live in `guests`, not in `reservations`.
* **Deliberate denormalisation**: `reservations.nightly_rate / tax_amount / total_amount` and `service_orders.unit_price` snapshot prices at booking time so later price changes never rewrite history.

## Indexes

`uq_*` unique indexes (above) plus `idx_res_room_dates (room_id, check_in, check_out)` for the availability overlap test, `idx_res_status_dates (status, check_in)` for the dashboard arrivals/departures queries, `idx_rooms_type_status`, `idx_audit_entity`, `idx_audit_created`.

## Database programmability

| Kind | Objects |
|---|---|
| Functions | `fn_nights`, `fn_setting_num`, `fn_loyalty_tier`, `fn_room_is_available`, `fn_has_permission`, `fn_reservation_balance` |
| Procedures | `sp_create_reservation`, `sp_create_booking` (multi-room, atomic), `sp_modify_reservation` (re-price + auto-refund), `sp_record_payment`, `sp_check_in`, `sp_check_out`, `sp_cancel_reservation`, `sp_revenue_by_month`, `sp_occupancy_report` |
| Triggers | `trg_emp_bu`, `trg_res_bi`, `trg_res_bu`, `trg_res_ai`, `trg_res_au`, `trg_pay_ai`, `trg_so_bi`, `trg_rooms_au`, `trg_hk_au` |
| Views | `v_reservation_details`, `v_guest_value` |
| CTEs | `sp_revenue_by_month` (2 CTEs), `sp_occupancy_report` (recursive), reports r04, r05, r08 |
| Roles | `hotel_admin`, `hotel_staff`, `hotel_guest` (`db/mysql/05_db_roles.sql`) |

## Configuration lives in the database

Business rules are rows in `hotel_settings`, read by `fn_setting_num(key, default)`:

| Setting | Read by |
|---|---|
| `tax_rate_pct` | `sp_create_reservation` (price), availability API, booking UI |
| `deposit_pct` | trigger `trg_pay_ai` (auto-confirm), payment modal |
| `free_cancel_hours` | `sp_cancel_reservation` (refund rule), UI copy |
| `max_stay_nights` | `sp_create_reservation`, `sp_create_booking`, `sp_modify_reservation` |
| `max_rooms_per_booking` | `sp_create_booking` |
| `require_verified_email` | booking API (blocks unverified guests when set to 1) |
| `loyalty_inr_per_point`, `loyalty_gold_points`, `loyalty_platinum_points` | `sp_check_out`, `fn_loyalty_tier`, loyalty card |
| `hotel_name`, `address`, `phone`, `email`, hero / story / footer copy | every public page |

Editing them: **Dashboard → Settings** (permission `settings.manage`, admin only). Changes are written in a transaction, audit-logged and take effect on the next booking.

## Schema evolution with `ALTER TABLE`

[`db/mysql/01b_alter_tables.sql`](../db/mysql/01b_alter_tables.sql) is applied after the base DDL and before the routines, so triggers and views can use what it adds:

| Statement | Kind | Purpose |
|---|---|---|
| `ALTER TABLE reservations ADD COLUMN source ENUM('online','front_desk') NOT NULL DEFAULT 'online' AFTER status;` | add column | Records how a booking was made; filled automatically by trigger `trg_res_bi` using `fn_has_permission` |
| `ALTER TABLE audit_log ADD INDEX idx_audit_action (action, created_at);` | add index | Fast filtering of the audit log by action |
| `ALTER TABLE payments ADD INDEX idx_pay_paid_at (paid_at);` | add index | Dashboard revenue queries filter payments by date |
| `ALTER TABLE users ADD CONSTRAINT chk_users_name CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2);` | add constraint | A name must have at least two non-blank characters |
| `ALTER TABLE guests ADD CONSTRAINT chk_guests_name CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2);` | add constraint | Same rule for guest profiles |
| `ALTER TABLE room_types MODIFY COLUMN view_type VARCHAR(60) NOT NULL;` | modify column | Widened from 40 to 60 characters for longer view descriptions |

These are exercised by automated test T-15. Every table and column is described in [DATA_DICTIONARY.md](DATA_DICTIONARY.md).
