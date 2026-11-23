# Testing Report

**Date:** 18 November 2026 · **Environment:** macOS (Apple silicon), Node.js 22.9, MySQL 26.10 (the schema needs MySQL 8.0 or newer), Neo4j 2026.10, Redis 8.10, Google Chrome 157.
The raw console output is saved in [test-output.txt](test-output.txt).

## 1. Summary

| Check | Command | Result |
|---|---|---|
| Automated tests (database rules + unit) | `npm test` | **20 passed, 0 failed** |
| Static type-check (TypeScript, strict) | `npm run typecheck` | **0 errors** |
| Lint (ESLint, Next.js + TypeScript rules) | `npm run lint` | **0 problems** |
| Production build | `npm run build` | **Success** (all pages and API routes compiled) |
| Live API / integration checks | scripted against the running app | **14 groups, all passed** (section 4) |

## 2. How the automated tests work

`npm test` creates a **separate** database `maison_aurelia_test` from the real SQL files (schema → `ALTER TABLE` migration → routines/triggers → seed), so the tests exercise exactly the code that ships and never touch real data. It then runs the Node.js built-in test runner (`node --test`). The concurrency test opens several MySQL connections at once.

## 3. Automated test cases

| ID | Test | What it proves | Result |
|---|---|---|---|
| T-1 | Prices a stay using the configured tax rate | 3 nights × ₹8,500 + 12% = ₹28,560; after changing `tax_rate_pct` to 18 the next booking is priced at 18% | ✔ |
| T-2 | Rejects invalid dates and over-long stays | check-out ≤ check-in, past dates and stays above the maximum are refused with clear messages | ✔ |
| T-3 | Enforces room capacity | 5 adults in a room for 2 is refused by the trigger | ✔ |
| T-4 | Never double-books under concurrency | two simultaneous requests for the last room: exactly one succeeds and the two bookings never share a room | ✔ |
| T-5 | Deposit confirms the booking | 20% stays *pending*, reaching 25% confirms; with the deposit setting at 50% a 30% payment stays *pending* | ✔ |
| T-6 | Refuses over-payment | paying more than the balance, or ≤ 0, is refused | ✔ |
| T-7 | Full stay lifecycle | early check-in refused; room becomes *occupied*; check-out refused while a balance is due; after payment, check-out sets room *cleaning*, creates a housekeeping task, awards 1 point per ₹100; finishing the task frees the room; a finished reservation cannot be reopened | ✔ |
| T-8 | Cancellation refund rules | full refund 450 days ahead; zero refund when arriving tomorrow (inside the window); a cancelled booking cannot be cancelled again | ✔ |
| T-9 | Multi-room booking is atomic | 3 rooms get the same `group_code` and different rooms; requesting 2 when 1 remains creates **none** (rolled back); 9 rooms refused | ✔ |
| T-10 | Modifying a booking | moving a paid 3-night Presidential booking to 2 nights in a Deluxe room re-prices it (₹19,040), refunds the overpayment, leaves balance 0; unavailable targets are refused; cancelled bookings cannot be modified | ✔ |
| T-11 | RBAC in the database | `fn_has_permission` gives admin/manager/receptionist/guest exactly their permissions; deactivated accounts lose everything | ✔ |
| T-12 | Constraints protect data | price 0 (CHECK), duplicate email (UNIQUE), deleting a room with history (FK), own-manager (trigger) all refused | ✔ |
| T-13 | Audit trail | creating a booking adds an `audit_log` row carrying the acting user | ✔ |
| T-14 | All 16 SQL reports run | every report in `04_queries.sql` executes and returns a result set | ✔ |
| T-15 | `ALTER TABLE` changes are in place | `source` is set to *online* / *front_desk* by trigger; blank-name CHECK refuses; both new indexes exist; `view_type` is 60 characters | ✔ |
| T-16 | CSV export | quoting, escaping and spreadsheet-formula neutralisation (`=SUM(...)` is prefixed) | ✔ |
| T-17 | Copy placeholders | `{rooms}` and `{free_cancel_hours}` are filled from live values | ✔ |
| T-18 | Slug generation | URL-safe slugs for new room types | ✔ |
| T-19 | Date and money helpers | night counts, month rollover, Indian digit grouping | ✔ |
| T-20 | No fallback secrets | missing, short or placeholder secrets are rejected | ✔ |

## 4. Live API / integration checks

Run against the running application with real HTTP requests and real MySQL, Neo4j and Redis (not automated; the commands were scripted with `curl`).

| ID | Scenario | Observed | Result |
|---|---|---|---|
| A-1 | Guest books 3 Deluxe rooms; pays each deposit; asks for more rooms than exist | 3 rooms (101–103) with one group code, all *confirmed*; the over-sized request is refused with no partial booking | ✔ |
| A-2 | Permission matrix over HTTP | receptionist is refused staff, reports, audit, settings, inventory, uploads; manager is refused settings, audit, user creation; guest is refused staff actions and sees only their own reservations; anonymous gets 401 | ✔ |
| A-3 | Availability, pagination, filters, dashboard, CSV | availability returns per-type counts with 18% tax after a settings change; page 2 of 7 returns the right 10 rows; dashboard endpoint returns KPIs and series; CSV downloads carry a BOM and quoted fields | ✔ |
| A-4 | PDF invoice | `application/pdf`, opens as a one-page invoice with room, tax, services, payments and balance; anonymous request is 401 | ✔ |
| A-5 | Modify a booking | guest changes dates and room type (price recalculated); guest asking for a specific room is refused; staff selects room 208 | ✔ |
| A-6 | Account security | verification link works once and a reused/forged token is refused; forgot-password gives the same answer for known and unknown emails; reset link works once, weak passwords are refused, old sessions and old password stop working; 9th bad login is 429; changing a user's role or disabling the account ends their session | ✔ |
| A-7 | Administration | admin creates a receptionist login who can sign in; role "guest" and non-admins are refused; employee create/update/delete works; own-manager and negative salary are refused | ✔ |
| A-8 | Services | catalogue create/price/deactivate/delete; deleting a previously ordered service is refused with advice; guest orders a service; receptionist confirms and delivers; guest cannot mark delivered | ✔ |
| A-9 | Emails | booking, payment, cancellation, change, verification and reset emails are written to `email_outbox` with status `not_configured` (no SMTP) | ✔ |
| A-10 | Inventory, rooms and housekeeping | PNG upload accepted and served; a text file renamed `.png`, a path-traversal URL and a `javascript:` image URL are refused; room type created, edited (price) and deleted; deleting a type with rooms or a room with history is refused; room status changes; occupied rooms cannot be changed; completing a housekeeping task frees the room | ✔ |
| A-11 | Reviews (Neo4j) | create requires an own, completed stay; a second review of the same stay is refused; guest edit; staff reply allowed, guest reply refused; delete by author; receptionist delete refused | ✔ |
| A-12 | Wishlist (Redis) | add, edit note, remove | ✔ |
| A-13 | Recommendations | "Recommended for you" appears for the demo guest (graph traversal with popularity fallback) | ✔ |
| A-14 | Public pages | `/`, `/rooms`, room pages, `/login`, `/forgot-password` return 200; content comes from the databases | ✔ |

## 5. Defects found by testing and fixed

| Defect | How it was found | Fix |
|---|---|---|
| Four dashboard pages crashed (server component called a client-only helper) | live page checks returned HTTP 500 | moved the helper to a shared module |
| Recommendations were empty and one report thin | live check of the guest account | seed data only ordered 4 of 14 services; fixed the seed formula and added a popularity fallback |
| 5 React rule violations (state set inside effects, a prop named `children`) | ESLint | restructured the components |
| Linter incompatible with TypeScript 7 | `npm run lint` failed to start | pinned TypeScript 5.9 |
| Tailwind failed on Node 22.9 | first build | npm scripts pass `--experimental-require-module` |
| App could not connect from Docker | design review | opt-in `MYSQL_ALLOW_ANY_HOST=1`; default is localhost-only |
| Hard-coded fallback secrets | code review | removed; `requireEnv` fails fast; covered by T-20 |

## 6. Limitations of this testing

* No automated browser (end-to-end) tests: the UI was checked by hand and through screenshots ([SCREENSHOTS.md](SCREENSHOTS.md)).
* No load or performance testing; concurrency was tested only for the booking race.
* The live API checks in section 4 were run by script but are not part of `npm test`.
* Payments are simulated; email delivery was verified only up to the outbox (no SMTP server was configured).
* Tested on macOS with a native install; the Windows and Docker set-up is documented but was not executed here.
