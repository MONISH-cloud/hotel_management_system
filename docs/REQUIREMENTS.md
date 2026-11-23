# Functional and Non-functional Requirements

Status key: **✔** implemented and verified · **◐** implemented with a stated limitation.
"Verified by" refers to the automated tests in [TEST_REPORT.md](TEST_REPORT.md) (T-n) or the live API checks listed there (A-n).

## 1. Functional requirements

### 1.1 Guest website and booking
| ID | Requirement | Status | Verified by |
|---|---|---|---|
| FR-01 | The system shall list room types with photos, price, size, capacity, view and amenities | ✔ | A-14 |
| FR-02 | The system shall show availability for chosen dates and party size and hide types that cannot fit the party | ✔ | A-3 |
| FR-03 | A guest shall be able to book 1 to N rooms (N is a setting) of one type in a single step; either all rooms are booked or none | ✔ | T-9, A-1 |
| FR-04 | The system shall compute the price from nights × nightly rate plus tax at the configured rate | ✔ | T-1 |
| FR-05 | A guest shall be able to pay a deposit or the full amount; a booking becomes *confirmed* when the deposit percentage is reached | ◐ simulated payment | T-5 |
| FR-06 | A guest shall be able to change dates or room type of an upcoming booking; the price is recalculated and any overpayment refunded | ✔ | T-10, A-5 |
| FR-07 | A guest shall be able to cancel an upcoming booking; the refund is full outside the free-cancellation window and zero inside it | ✔ | T-8 |
| FR-08 | A guest shall be able to order hotel services for a confirmed or in-house stay and cancel a request that is still "requested" | ✔ | A-8 |
| FR-09 | A guest shall be able to write, edit and delete one review per completed stay | ✔ | A-11 |
| FR-10 | A guest shall be able to save rooms to a wishlist with notes (add, edit, remove) | ✔ | A-12 |
| FR-11 | The system shall award loyalty points at check-out and upgrade the loyalty tier by configured thresholds | ✔ | T-7 |
| FR-12 | The system shall generate a PDF invoice for any stay | ✔ | A-4 |
| FR-13 | The system shall email booking, payment, cancellation and change notifications | ◐ sent only if SMTP is configured | A-9 |
| FR-14 | The system shall recommend services based on what similar guests ordered | ✔ | A-13 |

### 1.2 Accounts and access control
| ID | Requirement | Status | Verified by |
|---|---|---|---|
| FR-15 | Users shall register, sign in and sign out; passwords are stored only as bcrypt hashes | ✔ | A-6 |
| FR-16 | The system shall verify email addresses through single-use, expiring links (only a hash of the token is stored) | ✔ | A-6 |
| FR-17 | Users shall reset a forgotten password through a single-use link; all other sessions are then revoked | ✔ | A-6 |
| FR-18 | Access shall be controlled by four roles whose permissions are rows in `role_permissions`, checked on every page and API route | ✔ | T-11, A-2 |
| FR-19 | An administrator shall create staff logins, change a user's role and disable an account | ✔ | A-7 |
| FR-20 | Logging out or changing a user's role shall revoke their live sessions at once | ✔ | A-6 |
| FR-21 | Repeated failed logins shall be rate-limited | ✔ | A-6 |

### 1.3 Front-desk operations
| ID | Requirement | Status | Verified by |
|---|---|---|---|
| FR-22 | Staff shall search, filter and page through all reservations | ✔ | A-3 |
| FR-23 | Staff shall create a reservation for an existing or new (walk-in) guest, for 1–N rooms | ✔ | A-1 |
| FR-24 | Staff shall confirm, check in, check out, mark no-show, cancel and modify reservations (including choosing an exact room) | ✔ | T-7, T-10 |
| FR-25 | Check-in shall be refused before the arrival date and when the room is not ready; check-out shall be refused while a balance is due | ✔ | T-7 |
| FR-26 | Staff shall record payments; a payment above the outstanding balance shall be refused | ✔ | T-6 |
| FR-27 | Staff shall see room status by floor and change it (available / cleaning / maintenance) | ✔ | A-10 |
| FR-28 | A check-out shall create a housekeeping task and mark the room *cleaning*; completing the task shall free the room | ✔ | T-7 |
| FR-29 | Staff shall work a queue of service orders (confirm, deliver, cancel) | ✔ | A-8 |

### 1.4 Management and administration
| ID | Requirement | Status | Verified by |
|---|---|---|---|
| FR-30 | The dashboard shall show arrivals, departures, in-house guests, occupancy, revenue and outstanding balances, with charts | ✔ | A-3 |
| FR-31 | The system shall provide 16 analytical SQL reports (nested, correlated, recursive, joins, CTEs, window functions), viewable with their SQL and exportable as CSV | ✔ | T-14 |
| FR-32 | Managers shall create, edit and delete room types and rooms and upload photos; the database shall refuse deletions that would orphan history | ✔ | A-10 |
| FR-33 | Managers shall edit the service catalogue (price, activate/deactivate, add, delete) | ✔ | A-8 |
| FR-34 | Managers shall reply to or delete guest reviews | ✔ | A-11 |
| FR-35 | Administrators shall manage employees, their departments and reporting lines | ✔ | A-7 |
| FR-36 | Administrators shall edit hotel settings (policies, loyalty rules, contact details, website copy); the SQL routines read the same values | ✔ | T-1, T-5 |
| FR-37 | The system shall keep an audit trail (who, what, when) for bookings, payments, room changes, settings and account changes | ✔ | T-13 |
| FR-38 | Long lists shall be paginated and exportable as CSV (reservations, guests, audit log) | ✔ | A-3 |

### 1.5 Data integrity rules (enforced in MySQL)
| ID | Rule | Mechanism | Verified by |
|---|---|---|---|
| DR-01 | A room cannot be booked twice for overlapping dates | `sp_create_booking` locks the room type + `trg_res_bi` re-checks | T-4 |
| DR-02 | A party cannot exceed the room's capacity | trigger `trg_res_bi` | T-3 |
| DR-03 | Dates must be valid and stays no longer than the maximum | procedures | T-2 |
| DR-04 | Names, prices, quantities and amounts must satisfy CHECK constraints | 12 CHECK constraints | T-12, T-15 |
| DR-05 | Finalised reservations cannot be reopened | trigger `trg_res_bu` | T-7 |
| DR-06 | A service price is frozen on the order at order time | trigger `trg_so_bi` | A-8 |
| DR-07 | The booking channel (online / front desk) is recorded automatically | trigger + `fn_has_permission` | T-15 |

## 2. Non-functional requirements

| ID | Category | Requirement | How it is met |
|---|---|---|---|
| NFR-01 | Security | Passwords hashed; sessions revocable; no secrets in code | bcrypt, JWT + Redis session registry, `requireEnv` (no fallbacks), `.env.local` ignored by git |
| NFR-02 | Security | Injection-safe | Parameterised SQL everywhere; Zod validation; CSV formula-injection guard; uploads validated by magic bytes |
| NFR-03 | Security | Least privilege | Permission checks on every route; app DB account is localhost-only by default |
| NFR-04 | Reliability | Atomic multi-step changes | InnoDB transactions inside procedures; rollback handlers |
| NFR-05 | Reliability | Degrade gracefully | If Redis or Neo4j is down the site keeps working (cache/rate-limit/reviews are skipped) |
| NFR-06 | Performance | Fast availability and dashboards | Composite indexes (`idx_res_room_dates`, `idx_res_status_dates`, …), Redis-cached availability, server-side pagination |
| NFR-07 | Usability | Responsive and accessible UI | Mobile layouts, keyboard-operable dialogs/menus, visible focus, reduced-motion support |
| NFR-08 | Maintainability | Verifiable and documented | 20 automated tests, ESLint, strict TypeScript, generated data dictionary |
| NFR-09 | Portability | Runs on macOS, Windows, Docker | Plain Node scripts, documented setup, optional Docker databases |
| NFR-10 | Auditability | Every material change traceable | `audit_log` written by triggers with the acting user |
