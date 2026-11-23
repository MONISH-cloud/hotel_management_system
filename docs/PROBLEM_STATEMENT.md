# Problem Statement, Objectives and Scope

## 1. Problem statement

Small and mid-sized hotels typically run their business on a patchwork of tools: a paper or spreadsheet register for bookings, a separate billing tool, WhatsApp for housekeeping, and a basic website that cannot take bookings. This causes four recurring problems:

1. **Double bookings and stale availability.** When two people (a guest online and a receptionist at the desk) reserve the same room at the same time, nothing stops both.
2. **Rules that live in people's heads.** Deposit amounts, cancellation windows, tax and loyalty rules are applied inconsistently, so guests are refunded or charged differently depending on who handles them.
3. **No single record of a stay.** Room charges, spa and dining orders, payments and refunds are tracked in different places, so checkout is slow and disputes are hard to settle.
4. **No accountability or insight.** Managers cannot see occupancy and revenue at a glance, and there is no reliable record of who changed what.

Guests, in turn, expect to search, book, pay, change a booking and order services online, without phoning the hotel.

**Maison Aurelia Hotel Management System** is a web application that replaces these tools with one system in which the **database enforces the business rules**, guests serve themselves online, and staff work from role-appropriate screens.

## 2. Objectives

| # | Objective | How it is measured |
|---|---|---|
| O1 | Let guests search availability, book one or several rooms, pay, change or cancel online | Guest can complete a booking, modification and cancellation without staff help |
| O2 | Make double-booking impossible, even under simultaneous requests | Automated concurrency test: of two simultaneous requests for the last room, exactly one succeeds |
| O3 | Keep every business rule (tax, deposit, cancellation, loyalty) in one editable place and enforced by the database | Changing a setting changes the price/behaviour of the next booking with no code change (tested) |
| O4 | Give each type of user only the access they need (role-based access control stored in the database) | Permission matrix tested; unauthorised API calls return 403 |
| O5 | Give front-desk, housekeeping and management one live view of rooms, stays, services, payments and revenue | Dashboard, rooms board, housekeeping board, 16 SQL reports |
| O6 | Provide a complete, tamper-evident audit trail | Every create/modify/check-in/out/payment is written to `audit_log` by triggers with the acting user |
| O7 | Use the right database for each job (relational, graph, key-value) and justify the choice | MySQL for transactions, Neo4j for reviews/recommendations, Redis for sessions/cache |
| O8 | Deliver a polished, accessible, responsive interface | Custom design system, keyboard-accessible dialogs, mobile layouts (see screenshots) |
| O9 | Be maintainable and verifiable | 20 automated tests, ESLint, TypeScript, generated data dictionary |

## 3. Scope

### In scope
* **Guest website:** room catalogue, availability search, room details, reviews, booking of 1–5 rooms, simulated payment, booking modification and cancellation with refund rules, service ordering, wishlist, loyalty programme, PDF invoices, email notifications.
* **Accounts and security:** registration, login/logout, email verification, password reset, four roles (admin, manager, receptionist, guest), session revocation, login rate-limiting.
* **Staff operations:** reservations (create for guests, confirm, check-in/out, no-show, cancel, modify), payments, room status board, housekeeping tasks, service-order queue, guest directory.
* **Management:** dashboard KPIs and charts, 16 analytical SQL reports with CSV export, inventory (room types, rooms, photo upload), service catalogue, review moderation, employee hierarchy, user and role administration, hotel settings, audit log, CSV exports.
* **Data layer:** MySQL schema with constraints, stored procedures, functions, triggers, views, native database roles; Neo4j graph; Redis store.

### Out of scope (and why)
| Item | Reason |
|---|---|
| Real payment gateway | Requires merchant credentials from a provider; the payment flow is isolated in one API route so a provider can be added |
| Channel manager / OTA integrations (Booking.com etc.) | Needs partner APIs and contracts |
| Accounting, payroll and inventory-of-supplies modules | Outside hotel operations |
| Native mobile apps | The web interface is responsive |
| Multi-property / multi-currency support | Single hotel, Indian rupees |
| Real-time WebSocket push | The live feed polls Redis every 12 seconds |

### Assumptions and constraints
* One hotel property; prices in INR; tax is a single percentage.
* Dates are whole days (check-in and check-out), with check-out day not counted as an occupied night.
* Emails are sent only if SMTP settings are provided; otherwise they are recorded in `email_outbox`.
* Photos are stored on the server's disk (`uploads/`), so a multi-server deployment would need shared storage.

## 4. Stakeholders and users

| User | Needs | Role in the system |
|---|---|---|
| Guest | Book, pay, change, order services, review | `guest` |
| Receptionist | Handle arrivals/departures, payments, room status | `receptionist` |
| Manager | Revenue and occupancy insight, inventory, service catalogue, reviews | `manager` |
| Administrator | Manage staff accounts, permissions, settings, audit | `admin` |
