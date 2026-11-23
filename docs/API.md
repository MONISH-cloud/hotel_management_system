# REST API

All routes live in `src/app/api`. JSON in / JSON out. Errors: `{ "error": "message" }` with 400 (validation / business rule, including MySQL `SIGNAL` messages), 401 (not signed in), 403 (role lacks permission), 404, 409, 422, 429 (rate limit).

Auth is a signed `ma_session` cookie. "Perm" is the permission code from `role_permissions`.

| Method & path | Access | Description |
|---|---|---|
| `POST /api/auth/register` | public | Create guest account + profile (transaction), starts session |
| `POST /api/auth/login` | public (rate-limited) | bcrypt verify, issue JWT, register session in Redis |
| `POST /api/auth/logout` | any | Revoke session in Redis, clear cookie |
| `GET /api/auth/me` | any | Current user + permissions |
| `GET /api/health` | public | MySQL / Redis / Neo4j status |
| `GET /api/rooms/availability?checkIn&checkOut&adults&children` | public | Room types with free-room counts and price breakdown (Redis-cached) |
| `PATCH /api/rooms/:id` | `rooms.manage` | Set room status (available / cleaning / maintenance) |
| `GET /api/reservations` | signed in | Own reservations, or all with `reservations.view_all` (filters: `status`, `q`, `view`) |
| `POST /api/reservations` | `booking.own` / `reservations.book_for_guest` | Calls `sp_create_reservation` |
| `GET /api/reservations/:id` | owner / `reservations.view_all` | Folio with payments and orders |
| `PATCH /api/reservations/:id` `{action}` | owner (cancel) / `reservations.manage` | `check_in`, `check_out`, `cancel`, `confirm`, `no_show` via stored procedures |
| `POST /api/reservations/:id/payments` | owner / `payments.record` | Calls `sp_record_payment` |
| `POST /api/reservations/:id/orders` | owner / `orders.manage` | Order a service (trigger snapshots the price) |
| `PATCH /api/orders/:id` | `orders.manage` (guest may cancel own `requested`) | Update order status |
| `GET /api/services` | public | Active service catalogue |
| `POST /api/services`, `PATCH/DELETE /api/services/:id` | `services.manage` | Catalogue CRUD |
| `GET /api/reviews` | public | List reviews (Neo4j) |
| `POST /api/reviews` | `reviews.write` | Create review for an own completed stay |
| `PATCH /api/reviews/:id` | author, or `reviews.moderate` for `{reply}` | Update |
| `DELETE /api/reviews/:id` | author / `reviews.moderate` | Delete |
| `GET/POST/PATCH/DELETE /api/wishlist` | signed in | Wishlist CRUD (Redis hash) |
| `GET/POST /api/housekeeping`, `PATCH /api/housekeeping/:id` | `housekeeping.manage` | Tasks |
| `GET /api/guests?q=` | `guests.view` | Guest directory |
| `GET/POST /api/staff`, `PATCH/DELETE /api/employees/:id` | `staff.manage` | Employee CRUD |
| `PATCH /api/users/:id` | `staff.manage` | Enable/disable account, change role (revokes sessions) |
| `GET /api/reports/:id` | `reports.view` | Run one of the 16 SQL reports |
| `GET /api/dashboard` | `dashboard.view` | KPIs and chart data |
| `GET /api/feed` | `dashboard.view` | Live activity feed (Redis) |
| `GET /api/audit` | `audit.view` | Audit log |
| `GET/PATCH /api/settings` | `settings.manage` | Read / update hotel settings (validated by type, audit-logged) |
| `POST /api/auth/forgot` | public (rate-limited) | Email a password-reset link (identical answer whether or not the email exists) |
| `POST /api/auth/reset` | one-time token | Set a new password; revokes the user's other sessions |
| `POST /api/auth/verify`, `POST /api/auth/resend-verification` | token / signed in | Confirm / resend the email-verification link |
| `POST /api/users` | `staff.manage` | Create a staff login (admin, manager or receptionist) |
| `GET /api/reservations/:id/invoice` | owner / `reservations.view_all` | PDF invoice |
| `PATCH /api/reservations/:id` `{action:"modify"}` | owner / `reservations.manage` | Change dates, room type or (staff) exact room; re-prices and refunds overpayment via `sp_modify_reservation` |
| `POST /api/reservations` `{rooms: n}` | as above | Book up to `max_rooms_per_booking` rooms atomically (`sp_create_booking`) |
| `GET /api/reservations?page=&limit=` | signed in | Paginated (`total`, `pages` in the response) |
| `GET /api/export/{reservations,guests,audit}` | respective view permission | CSV download |
| `GET /api/reports/:id?format=csv` | `reports.view` | Report as CSV |
| `GET/POST /api/room-types`, `PATCH/DELETE /api/room-types/:id` | `inventory.manage` | Room-type CRUD with amenities |
| `GET /api/rooms`, `POST /api/rooms`, `DELETE /api/rooms/:id` | `rooms.manage` / `inventory.manage` | Room list / create / delete (FK stops deleting rooms with history) |
| `POST /api/upload`, `GET /api/media/:name` | `inventory.manage` / public | Photo upload (type sniffed from file bytes, 4 MB max) and serving |
