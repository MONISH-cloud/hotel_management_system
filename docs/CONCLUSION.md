# Conclusion and Future Enhancements

## Conclusion

Maison Aurelia shows that a hotel's most error-prone rules can be placed where they cannot be bypassed: in the database. Availability, pricing, deposits, refunds, check-in/out, housekeeping hand-offs, loyalty and auditing are implemented as stored procedures, functions and triggers, and the application is a thin, permission-checked layer over them. This is why a booking made online, by the front desk or directly through SQL obeys the same rules, and why 20 automated tests can verify the rules without a browser.

Against the objectives in [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md):

| Objective | Outcome |
|---|---|
| O1 Online search, booking (1–5 rooms), payment, change, cancel | Delivered |
| O2 No double-booking | Delivered; proven with a concurrent-request test |
| O3 Editable rules enforced by the database | Delivered (`hotel_settings` read by `fn_setting_num`); changing a setting changes the next booking |
| O4 Database-backed RBAC | Delivered (4 roles, 18 permissions) |
| O5 One live view of operations | Delivered (dashboard, rooms board, housekeeping, 16 reports) |
| O6 Audit trail | Delivered (written by triggers with the acting user) |
| O7 Right database per job | Delivered (MySQL, Neo4j, Redis) and justified |
| O8 Polished, accessible UI | Delivered; see [SCREENSHOTS.md](SCREENSHOTS.md) |
| O9 Tests and documentation | 20 automated tests, ESLint, generated data dictionary, 13 documents |

**What was learned.** Putting rules in the database made the application simpler and safer, but it required careful transaction design (row locking to stop races, rollback handlers, `SIGNAL` errors that the API turns into friendly messages). Polyglot persistence worked well because MySQL stayed the single source of truth and the other stores degrade gracefully. Writing tests against a throw-away database built from the real SQL files caught problems early and kept the schema honest.

## Known limitations

* **Payments are simulated.** The flow is isolated in one API route, but no real gateway is connected.
* **Email needs SMTP settings to be delivered;** otherwise messages are recorded in `email_outbox`.
* **Single property, single currency, single tax rate.**
* **Photos are stored on local disk,** which does not scale to several servers without shared storage.
* **No end-to-end browser tests or load tests.**
* **Native MySQL roles are provisioned but not used by the application,** which connects with one least-privilege account; access control in the app is enforced by permission rows read from MySQL.
* **No vector search.** Neo4j and Redis are used as graph and key-value stores only.

## Future enhancements

| Priority | Enhancement | Value |
|---|---|---|
| High | Integrate a payment gateway (Razorpay / Stripe) with webhooks and real refunds | Real money handling |
| High | Browser end-to-end tests (Playwright) and a CI pipeline (lint, type-check, tests on every push) | Safer releases |
| High | Move photos to object storage (S3-compatible) with image resizing | Scalability and speed |
| Medium | Per-night dynamic pricing (weekends, seasons, occupancy) and promo codes | Revenue |
| Medium | Calendar (timeline) view of room occupancy with drag-and-drop moves | Front-desk speed |
| Medium | Neo4j vector index for semantic review search and "rooms like this" | Discovery |
| Medium | Two-factor authentication for staff; per-role database connections using the provisioned MySQL roles | Security |
| Medium | Role and permission editor in the UI | Administration |
| Low | Multi-property and multi-currency support | Growth |
| Low | WebSocket/Server-Sent Events for the live feed; push/SMS notifications | Real-time operations |
| Low | Channel-manager integration (OTA availability and rates sync) | Distribution |
| Low | Localisation (Hindi and other languages) | Reach |
