# Application Screenshots

Captured from the running application with `npm run docs:screenshots` (headless Chrome, demo data). Each guest/staff screen is shown signed in as the role named in the caption.

## Guest website

### 1. Home page
![Home page](screenshots/01-home.png)
Hero with live booking bar, rating computed from Neo4j reviews, room count and prices read from MySQL, all copy driven by the `hotel_settings` table.

### 2. Rooms and suites
![Rooms](screenshots/02-rooms.png)
Availability for the chosen dates (cached in Redis), price, capacity, rating and a wishlist heart on every card.

### 3. Room detail and booking panel
![Room detail](screenshots/03-room-detail.png)
Amenities, guest reviews from the graph, "guests also stayed in" suggestions, and a booking panel with a rooms stepper, live price breakdown (tax rate from settings) and free-cancellation notice.

### 4. Sign in
![Login](screenshots/04-login.png)
The side panel quotes a real five-star review from Neo4j; demo-account buttons are read from the `users` table.

### 5. Guest account
![Guest account](screenshots/05-guest-account.png)
Loyalty tier and progress, graph-based recommendations, bookings with balances, invoice download, change/cancel actions and multi-room group badges.

### 6. Change a booking
![Modify booking](screenshots/06-modify-booking.png)
New dates and room type with live availability and a recalculated total; overpayment is refunded automatically by `sp_modify_reservation`.

### 15. Mobile layout
![Mobile home](screenshots/15-mobile-home.png)

## Staff dashboard

### 7. Overview (administrator)
![Dashboard](screenshots/07-dashboard.png)
KPIs, occupancy forecast (`sp_occupancy_report`, recursive CTE), revenue (`sp_revenue_by_month`), room status, today's arrivals/departures with one-click actions and the live Redis activity feed.

### 8. Reservations (receptionist)
![Reservations](screenshots/08-reservations.png)
Search, status and view filters, pagination, CSV export, and per-row actions.

### 9. New reservation (receptionist)
![New reservation](screenshots/09-new-reservation.png)
Existing or walk-in guest, room type with live availability, dates and number of rooms (multi-room bookings).

### 10. Inventory (manager)
![Inventory](screenshots/10-inventory.png)
Create and edit room types (price, capacity, amenities, photo upload) and rooms.

### 11. SQL reports (manager)
![SQL reports](screenshots/11-sql-reports.png)
The SQL of each of the 16 reports (nested, correlated, recursive, CTE, window functions) beside its live result, with CSV export.

### 12. Staff and access (administrator)
![Staff and access](screenshots/12-staff-access.png)
Employees and reporting lines, accounts and roles, the role-permission matrix, and creation of staff logins.

### 13. Hotel settings (administrator)
![Settings](screenshots/13-settings.png)
Policies (tax, deposit, cancellation window, maximum stay and rooms), loyalty rules and website copy; the stored procedures read the same values.

### 14. Activity and audit log (administrator)
![Audit log](screenshots/14-activity-audit.png)
Health of the three databases, the paginated audit trail written by triggers, and the email outbox.
