<div align="center">

<img src="docs/assets/banner.svg" alt="Maison Aurelia — Hotel Management System" width="100%">

<br>

**A full-stack hotel platform where the *database* enforces the rules.**
Guests book, pay and change stays online. Staff run the hotel from a role-based dashboard.
Three databases, each doing the job it is best at.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[![MySQL](https://img.shields.io/badge/MySQL-8%2B-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-Graph-008CC1?style=for-the-badge&logo=neo4j&logoColor=white)](https://neo4j.com)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)

![Tests](https://img.shields.io/badge/tests-20%20passing-2ea44f?style=flat-square)
![Lint](https://img.shields.io/badge/eslint-0%20problems-4B32C3?style=flat-square&logo=eslint&logoColor=white)
![Types](https://img.shields.io/badge/typescript-strict-3178C6?style=flat-square)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2020.9-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Docs](https://img.shields.io/badge/docs-13%20documents-c9a96a?style=flat-square)

<br>

[**Features**](#-features) ·
[**Screenshots**](#-screenshots) ·
[**Video**](docs/walkthrough/maison-aurelia-walkthrough.mp4) ·
[**Architecture**](#-architecture) ·
[**Quick start**](#-quick-start) ·
[**Demo logins**](#-demo-accounts) ·
[**Docs**](#-documentation)

</div>

<br>

<p align="center">
  <img src="docs/screenshots/01-home.png" alt="Maison Aurelia home page" width="92%">
</p>

<p align="center">🎬 <b><a href="docs/walkthrough/maison-aurelia-walkthrough.mp4">Watch the 4½-minute narrated walkthrough</a></b> <sub>(<a href="docs/walkthrough/maison-aurelia-walkthrough.srt">captions</a>)</sub></p>

---

## ✨ At a glance

<div align="center">

| 🗄️ **23** tables | ⚙️ **9** stored procedures | ⚡ **9** triggers | 🧮 **6** SQL functions |
|:---:|:---:|:---:|:---:|
| 🔌 **40** API routes | 📊 **16** live SQL reports | 🔐 **4** roles · **18** permissions | ✅ **20** automated tests |

</div>

## 🎯 Why this exists

Small hotels run on spreadsheets, a billing tool and WhatsApp groups. That means **double bookings**, **rules applied differently by whoever is on shift**, **no single record of a stay**, and **no trail of who changed what**.

Maison Aurelia puts those rules **inside MySQL** (stored procedures, triggers, constraints), so a booking made on the website, at the front desk or straight in SQL obeys the *same* rules, and thousands of simultaneous requests still can't sell the same room twice.

> 📄 Full write-up: [Problem statement, objectives & scope](docs/PROBLEM_STATEMENT.md) · [38 functional requirements](docs/REQUIREMENTS.md)

---

## 🏨 Features

<table>
<tr>
<td width="33%" valign="top">

### 🛎️ Guests
- Search availability by dates and party size
- Book **1–5 rooms** in one atomic step
- Pay a deposit or in full *(simulated gateway)*
- **Change dates / room** with automatic re-pricing and refund
- Cancel with a configurable **refund window**
- Order spa, dining and transport during a stay
- **PDF invoices**, email notifications
- Reviews, wishlist, loyalty tiers
- Graph-powered **"guests like you also…"** suggestions

</td>
<td width="33%" valign="top">

### 🔑 Front desk
- Search, filter and page through all reservations
- Create bookings for existing or **walk-in** guests
- Confirm · check in · check out · no-show · cancel · modify
- Take payments (over-payment is refused)
- Live **room board** by floor
- **Housekeeping** kanban: checkout creates a task, finishing it frees the room
- Service-order queue
- **CSV export**

</td>
<td width="33%" valign="top">

### 📈 Management
- Live dashboard: arrivals, occupancy, revenue, outstanding
- **16 SQL reports** shown beside their query *(nested, correlated, recursive, CTE, window)*
- **Inventory**: room types, rooms, amenities, **photo upload**
- Service catalogue and review moderation
- Staff, reporting lines, **role matrix**, create logins
- **Hotel settings**: tax, deposit, cancellation, loyalty, site copy
- Full **audit log** and email outbox

</td>
</tr>
</table>

<details>
<summary><b>🧩 Data-integrity rules enforced in MySQL (click to expand)</b></summary>

<br>

| Rule | Mechanism |
|---|---|
| A room can't be booked twice for overlapping dates, even under concurrent requests | `sp_create_booking` locks the room type (`FOR UPDATE`) + trigger `trg_res_bi` re-checks |
| A party can't exceed room capacity | trigger `trg_res_bi` |
| A deposit confirms a booking automatically | trigger `trg_pay_ai` (percentage read from settings) |
| Check-out only when the balance is settled | `sp_check_out` |
| Refund depends on the free-cancellation window | `sp_cancel_reservation` |
| A modified stay is re-priced; overpayment is refunded | `sp_modify_reservation` |
| Check-out creates a housekeeping task; finishing it frees the room | triggers `trg_res_au`, `trg_hk_au` |
| Service prices are frozen when ordered | trigger `trg_so_bi` |
| Every material change is logged with the acting user | triggers → `audit_log` |
| Tax, deposit, cancellation and loyalty rules are **editable rows**, not code | `hotel_settings` + `fn_setting_num()` |

</details>

---

## 📸 Screenshots

<table>
<tr>
<td align="center" width="50%"><img src="docs/screenshots/02-rooms.png" alt="Rooms"><br><sub><b>Rooms & live availability</b></sub></td>
<td align="center" width="50%"><img src="docs/screenshots/03-room-detail.png" alt="Room detail"><br><sub><b>Room detail & booking panel</b></sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/05-guest-account.png" alt="Guest account"><br><sub><b>Guest account: loyalty, bookings, recommendations</b></sub></td>
<td align="center"><img src="docs/screenshots/06-modify-booking.png" alt="Modify booking"><br><sub><b>Change a booking, re-priced live</b></sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/07-dashboard.png" alt="Dashboard"><br><sub><b>Staff dashboard</b></sub></td>
<td align="center"><img src="docs/screenshots/11-sql-reports.png" alt="SQL reports"><br><sub><b>16 live SQL reports with their source</b></sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/10-inventory.png" alt="Inventory"><br><sub><b>Inventory & photo upload</b></sub></td>
<td align="center"><img src="docs/screenshots/13-settings.png" alt="Settings"><br><sub><b>Hotel settings read by SQL routines</b></sub></td>
</tr>
</table>

<details>
<summary>More screens</summary>

<br>

<table>
<tr>
<td align="center" width="50%"><img src="docs/screenshots/08-reservations.png" alt="Reservations"><br><sub>Reservations</sub></td>
<td align="center" width="50%"><img src="docs/screenshots/09-new-reservation.png" alt="New reservation"><br><sub>New reservation (multi-room)</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/12-staff-access.png" alt="Staff and access"><br><sub>Staff, accounts and role matrix</sub></td>
<td align="center"><img src="docs/screenshots/14-activity-audit.png" alt="Audit log"><br><sub>Audit log and email outbox</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/04-login.png" alt="Login"><br><sub>Sign in</sub></td>
<td align="center"><img src="docs/screenshots/15-mobile-home.png" alt="Mobile" width="200"><br><sub>Responsive on mobile</sub></td>
</tr>
</table>

</details>

---

## 🧠 Architecture

```mermaid
flowchart LR
  B["🌐 Browser<br/>React UI"] --> P["🛡️ proxy.ts<br/>route protection"]
  P --> A["⚙️ Next.js server<br/>pages + REST API"]
  A --> L["📦 Data layer<br/>src/lib"]
  L -->|"SQL + CALL sp_*"| M[("🗄️ MySQL<br/>transactions · rules · RBAC")]
  L -->|"Cypher"| N[("🕸️ Neo4j<br/>reviews · recommendations")]
  L -->|"commands"| R[("⚡ Redis<br/>sessions · cache · feed")]
  L -->|"SMTP / outbox"| E["✉️ Email"]
```

**Polyglot persistence, justified:**

| Store | Holds | Why this one |
|---|---|---|
| 🗄️ **MySQL** | Bookings, payments, rooms, guests, RBAC, settings, audit | ACID transactions, row locks (no double-booking), FKs, CHECKs, triggers, stored routines, CTEs |
| 🕸️ **Neo4j** | `(Guest)-[:WROTE]->(Review)-[:ABOUT]->(RoomType)`, stays, orders | Reviews and recommendations are *relationship* queries: two-hop traversals in Cypher, heavy joins in SQL |
| ⚡ **Redis** | Sessions, permission & availability cache, rate limits, wishlist, live feed | Sub-millisecond access with automatic expiry; keeps ephemeral writes off the system of record |

If Neo4j or Redis is down, the booking path (MySQL only) **keeps working**.

<details>
<summary><b>📐 Core data model</b> (full diagram: <a href="docs/ER_DIAGRAM.md">ER_DIAGRAM.md</a> · <a href="docs/DATA_DICTIONARY.md">data dictionary</a>)</summary>

```mermaid
erDiagram
  ROLES ||--o{ USERS : has
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : in
  USERS |o--o| GUESTS : owns
  GUESTS ||--o{ RESERVATIONS : makes
  ROOM_TYPES ||--o{ ROOMS : classifies
  ROOMS ||--o{ RESERVATIONS : "booked in"
  RESERVATIONS ||--o{ PAYMENTS : "settled by"
  RESERVATIONS ||--o{ SERVICE_ORDERS : includes
  SERVICES ||--o{ SERVICE_ORDERS : "ordered as"
  ROOMS ||--o{ HOUSEKEEPING_TASKS : needs
  EMPLOYEES |o--o{ EMPLOYEES : manages
```

</details>

<details>
<summary><b>🔒 Security model</b></summary>

<br>

- Passwords hashed with **bcrypt**; sessions are signed JWTs **registered in Redis**, so logout, role change and password reset revoke them instantly.
- **RBAC lives in MySQL**: `roles → role_permissions → permissions`, checked on every page and API route (cached 5 min in Redis) and available in SQL as `fn_has_permission()`.
- Login **rate-limiting**, single-use hashed tokens for password reset and email verification, parameterised SQL everywhere, Zod validation, upload type checked from file bytes, CSV formula-injection guard.
- **No fallback secrets**: the app refuses to start while `.env.local` still has placeholders.

| | Guest | Receptionist | Manager | Admin |
|---|:---:|:---:|:---:|:---:|
| Book & manage own stays, review | ✅ | | | ✅ |
| Reservations, check-in/out, payments, rooms, housekeeping | | ✅ | ✅ | ✅ |
| Reports, inventory, service catalogue, review moderation | | | ✅ | ✅ |
| Staff & accounts, hotel settings, audit log | | | | ✅ |

</details>

---

## 🚀 Quick start

> **Prerequisites:** Node.js ≥ 20.9, MySQL 8+, Redis 6+, Neo4j 5+ (Java 21). Databases can be native installs or Docker containers.

<details open>
<summary><b>1 · Start the databases</b></summary>

<br>

**macOS (Homebrew)**
```bash
brew install mysql redis neo4j
brew services start mysql && brew services start redis
neo4j-admin dbms set-initial-password '<choose-a-neo4j-password>'
brew services start neo4j
```

**Docker (any OS)**
```bash
docker run -d --name ma-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=<mysql-root-password> mysql:8.4
docker run -d --name ma-redis -p 6379:6379 redis:7
docker run -d --name ma-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/<neo4j-password> neo4j:5
```
*(With Docker, also add `MYSQL_ALLOW_ANY_HOST=1` to `.env.local`.)*

</details>

<details open>
<summary><b>2 · Configure, seed, run</b></summary>

<br>

```bash
git clone https://github.com/MONISH-cloud/hotel_management_system.git
cd hotel_management_system
npm install
cp .env.example .env.local      # then replace every `change-me…` value (below)
npm run db:all                  # MySQL schema + procedures + seed data, Neo4j graph, Redis warm-up
npm run dev                     # → http://localhost:3000
```

| `.env.local` variable | Set it to |
|---|---|
| `MYSQL_PASSWORD` | A password of your choice (the setup script creates the app's MySQL user with it) |
| `MYSQL_ROOT_PASSWORD` | Your MySQL root password (empty if none); used only by setup scripts |
| `NEO4J_PASSWORD` | The password you set for Neo4j |
| `JWT_SECRET` | 32+ random characters: `openssl rand -hex 32` |

`GET /api/health` reports the status of all three databases. Email works without SMTP (messages are recorded under **Dashboard → Activity**); add `SMTP_*` variables to send them for real.

</details>

### 🔑 Demo accounts

Password for all: **`Password@123`** *(demo data; the login page also has one-click buttons)*

| Role | Email | Try this |
|---|---|---|
| 👑 **Admin** | `admin@maisonaurelia.com` | Settings, staff accounts, audit log |
| 📊 **Manager** | `manager@maisonaurelia.com` | Inventory, SQL reports, reviews |
| 🛎️ **Receptionist** | `frontdesk@maisonaurelia.com` | Check guests in and out, take payments |
| 🧳 **Guest** | `guest@maisonaurelia.com` | Book 2 rooms, change dates, download an invoice |

---

## ✅ Quality

```bash
npm test            # builds a throw-away DB from the real SQL files, runs 20 tests
npm run test:api    # 73 HTTP tests against an isolated copy of the whole stack (needs MySQL + Redis running)
npm run lint        # ESLint (Next.js + TypeScript)      → 0 problems
npm run typecheck   # strict TypeScript                  → 0 errors
```

The suite includes a **concurrency test** (two simultaneous requests for the last room: exactly one wins), pricing and refund rules, atomic multi-room bookings, booking modification, RBAC, constraints, audit trail, all 16 reports and the `ALTER TABLE` migration. Details: [TEST_REPORT.md](docs/TEST_REPORT.md).

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Run the app |
| `npm run db:setup` · `db:seed-nosql` · `db:all` | Create and seed MySQL · Neo4j + Redis · everything |
| `npm run docs:dictionary` | Regenerate the [data dictionary](docs/DATA_DICTIONARY.md) from the live database |
| `npm run docs:screenshots` | Re-capture the screenshots above (needs the app running and Chrome) |

---

## 🗂️ Project structure

```text
db/
  mysql/     01_schema · 01b_alter_tables · 02_routines · 03_seed · 04_queries · 05_db_roles
  neo4j/     schema.cypher
src/
  app/       pages (site · rooms · account · dashboard/*) and api/* (REST)
  components/  UI building blocks
  lib/       db · cache (Redis) · graph (Neo4j) · auth · settings · mailer · invoice · csv
tests/       database rules + unit tests
scripts/     setup-db · seed-nosql · run-tests · gen-data-dictionary · take-screenshots · walkthrough/
docs/        13 documents + screenshots
```

## 📚 Documentation

| | |
|---|---|
| 📌 [Problem statement, objectives, scope](docs/PROBLEM_STATEMENT.md) | 📋 [Requirements](docs/REQUIREMENTS.md) |
| 🧠 [System architecture](docs/ARCHITECTURE.md) | 🧬 [ER diagram](docs/ER_DIAGRAM.md) |
| 📐 [Relational schema + `ALTER TABLE`](docs/RELATIONAL_SCHEMA.md) | 📖 [Data dictionary](docs/DATA_DICTIONARY.md) |
| 🕸️ [NoSQL design](docs/NOSQL.md) | 🔌 [REST API](docs/API.md) |
| ⚖️ [Technology justification](docs/TECHNOLOGY_JUSTIFICATION.md) | 🖼️ [Screenshots](docs/SCREENSHOTS.md) |
| 🧪 [Testing report](docs/TEST_REPORT.md) | 🏁 [Conclusion & future work](docs/CONCLUSION.md) |
| 👥 [Team & responsibilities](docs/TEAM.md) | 🎬 [Narrated walkthrough video](docs/walkthrough/maison-aurelia-walkthrough.mp4) |

## 🛣️ Roadmap

- [ ] Real payment gateway (Razorpay / Stripe) with webhooks
- [ ] Playwright end-to-end tests and a CI pipeline
- [ ] Object storage (S3) for photos
- [ ] Dynamic nightly pricing and promo codes
- [ ] Occupancy calendar with drag-and-drop
- [ ] Neo4j vector index for semantic review search
- [ ] Two-factor authentication for staff
- [ ] Multi-property and multi-currency

## ⚠️ Honest limitations

Payments are **simulated** (no gateway credentials); email is only delivered when SMTP is configured; single property and currency; photos are stored on local disk. See [CONCLUSION.md](docs/CONCLUSION.md).

---

<div align="center">

Built as a database-systems project · Maintained by [**@MONISH-cloud**](https://github.com/MONISH-cloud)
<sub>Hotel photography via <a href="https://unsplash.com">Unsplash</a>.</sub>

</div>
