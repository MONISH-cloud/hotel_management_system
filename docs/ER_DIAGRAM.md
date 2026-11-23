# Entity-Relationship Diagram

Rendered automatically by GitHub / VS Code (Mermaid). Crow's-foot notation:
`||` exactly one · `o|` zero or one · `o{` zero or many · `|{` one or many.

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigned to"
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "included in"
    USERS |o--o| GUESTS : "may own profile"
    USERS |o--o| EMPLOYEES : "may be"
    DEPARTMENTS ||--o{ EMPLOYEES : employs
    EMPLOYEES |o--o{ EMPLOYEES : "manages (self-ref)"
    ROOM_TYPES ||--o{ ROOMS : classifies
    ROOM_TYPES ||--o{ ROOM_TYPE_AMENITIES : offers
    AMENITIES ||--o{ ROOM_TYPE_AMENITIES : "provided in"
    GUESTS ||--o{ RESERVATIONS : makes
    ROOMS ||--o{ RESERVATIONS : "booked in"
    USERS |o--o{ RESERVATIONS : "created by"
    RESERVATIONS ||--o{ PAYMENTS : "settled by"
    RESERVATIONS ||--o{ SERVICE_ORDERS : includes
    SERVICES ||--o{ SERVICE_ORDERS : "ordered as"
    ROOMS ||--o{ HOUSEKEEPING_TASKS : needs
    EMPLOYEES |o--o{ HOUSEKEEPING_TASKS : performs
    USERS |o--o{ AUDIT_LOG : "acted in"
    SERVICES }o--|| SERVICE_CATEGORIES : "displayed under"
    USERS ||--o{ USER_TOKENS : "receives"

    ROLES { tinyint role_id PK
            varchar role_name UK }
    PERMISSIONS { smallint permission_id PK
                  varchar code UK }
    ROLE_PERMISSIONS { tinyint role_id PK,FK
                       smallint permission_id PK,FK }
    USERS { int user_id PK
            tinyint role_id FK
            varchar email UK
            varchar password_hash
            varchar full_name
            boolean is_active
            datetime email_verified_at }
    GUESTS { int guest_id PK
             int user_id FK,UK
             varchar email UK
             varchar full_name
             enum loyalty_tier
             int loyalty_points }
    DEPARTMENTS { smallint department_id PK
                  varchar name UK }
    EMPLOYEES { int employee_id PK
                int user_id FK,UK
                smallint department_id FK
                int manager_id FK
                varchar job_title
                decimal monthly_salary }
    ROOM_TYPES { smallint type_id PK
                 varchar slug UK
                 varchar name UK
                 decimal base_price
                 tinyint max_adults
                 tinyint max_children }
    ROOMS { int room_id PK
            smallint type_id FK
            varchar room_number UK
            tinyint floor_no
            enum status }
    AMENITIES { smallint amenity_id PK
                varchar name UK }
    ROOM_TYPE_AMENITIES { smallint type_id PK,FK
                          smallint amenity_id PK,FK }
    RESERVATIONS { int reservation_id PK
                   char reservation_code UK
                   int guest_id FK
                   int room_id FK
                   int created_by FK
                   char group_code
                   date check_in
                   date check_out
                   enum status
                   enum source
                   decimal total_amount }
    PAYMENTS { int payment_id PK
               int reservation_id FK
               enum payment_type
               enum method
               decimal amount
               varchar reference UK }
    SERVICES { smallint service_id PK
               varchar name UK
               enum category
               decimal price }
    SERVICE_ORDERS { int order_id PK
                     int reservation_id FK
                     smallint service_id FK
                     tinyint quantity
                     decimal unit_price
                     enum status }
    HOUSEKEEPING_TASKS { int task_id PK
                         int room_id FK
                         int employee_id FK
                         enum task_type
                         enum status }
    HOTEL_SETTINGS { varchar setting_key PK
                     varchar setting_value
                     enum value_type
                     varchar group_name }
    SITE_FEATURES { smallint feature_id PK
                    varchar title UK
                    varchar icon }
    SERVICE_CATEGORIES { enum category PK
                         varchar title
                         varchar image_url }
    SITE_MEDIA { varchar media_key PK
                 varchar url }
    USER_TOKENS { char token_hash PK
                  int user_id FK
                  enum purpose
                  datetime expires_at
                  datetime used_at }
    EMAIL_OUTBOX { bigint email_id PK
                   varchar to_address
                   varchar subject
                   enum status }
    AUDIT_LOG { bigint log_id PK
                int actor_user_id
                varchar action
                varchar entity
                json details }
```

## Cardinalities explained

| Relationship | Cardinality | Why |
|---|---|---|
| ROLES → USERS | 1 : N | Every account has exactly one role |
| ROLES ↔ PERMISSIONS | M : N via `role_permissions` | A role bundles many permissions; a permission belongs to many roles |
| USERS → GUESTS | 1 : 0..1 | Walk-in guests have no online account |
| USERS → EMPLOYEES | 1 : 0..1 | Not every employee has a system login |
| EMPLOYEES → EMPLOYEES | 1 : N (recursive) | `manager_id` builds the reporting hierarchy |
| ROOM_TYPES ↔ AMENITIES | M : N via `room_type_amenities` | Amenity matrix per room category |
| GUESTS → RESERVATIONS | 1 : N | A guest can book many stays |
| ROOMS → RESERVATIONS | 1 : N | A room is booked many times (never overlapping, enforced by trigger) |
| RESERVATIONS → PAYMENTS | 1 : N | Deposit, balance and refunds |
| RESERVATIONS → SERVICE_ORDERS | 1 : N | Spa, dining and transport added to the folio |
| RESERVATIONS ↔ RESERVATIONS | grouped by `group_code` | The rooms of one multi-room booking share a code (booked atomically by `sp_create_booking`) |
| USERS → USER_TOKENS | 1 : N | One-time password-reset and email-verification tokens (hash only) |

`hotel_settings`, `site_features`, `service_categories` and `site_media` hold configuration and website content (policies, copy, images). `service_categories.category` is the same ENUM as `services.category`, so the join is by value, not a foreign key.

The graph (Neo4j) and key-value (Redis) models are documented in [NOSQL.md](NOSQL.md).
