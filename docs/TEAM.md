# Team Members and Responsibilities

> **To be completed by the team.** The author of this repository cannot know who on your team did which part, so the names and roles below are left blank on purpose. Replace every `[Name]` and `[Roll no.]`, and tick the deliverables each person owns. The four demo logins in the app (Monish R, Nanditha A, Arora Mehtha, Sakshi Khanna) are sample accounts only; they do not assign any role.

## Members

| # | Name | Roll no. | Primary role |
|---|---|---|---|
| 1 | [Name] | [Roll no.] | [e.g. Database lead] |
| 2 | [Name] | [Roll no.] | [e.g. Backend / API lead] |
| 3 | [Name] | [Roll no.] | [e.g. Frontend / UI lead] |
| 4 | [Name] | [Roll no.] | [e.g. Testing and documentation] |

## Responsibilities: database

| Area | Deliverables (files) | Owner |
|---|---|---|
| Requirements, ER design and normalisation | [ER_DIAGRAM.md](ER_DIAGRAM.md), [RELATIONAL_SCHEMA.md](RELATIONAL_SCHEMA.md) | [Name] |
| DDL: tables, keys, constraints, indexes | `db/mysql/01_schema.sql` | [Name] |
| `ALTER TABLE` schema evolution | `db/mysql/01b_alter_tables.sql` | [Name] |
| DML: seed data and sample operations | `db/mysql/03_seed.sql` | [Name] |
| Stored procedures, functions, triggers, views | `db/mysql/02_routines.sql` | [Name] |
| Analytical SQL (nested, correlated, recursive, CTE, window) | `db/mysql/04_queries.sql` | [Name] |
| Database-level RBAC and roles | `db/mysql/05_db_roles.sql`, `roles` / `permissions` tables | [Name] |
| NoSQL: Neo4j graph and Redis design | `db/neo4j/schema.cypher`, [NOSQL.md](NOSQL.md), `src/lib/graph.ts`, `src/lib/cache.ts` | [Name] |
| Data dictionary | [DATA_DICTIONARY.md](DATA_DICTIONARY.md), `scripts/gen-data-dictionary.mjs` | [Name] |

## Responsibilities: application

| Area | Deliverables (files) | Owner |
|---|---|---|
| Authentication, sessions, password reset, verification | `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/auth/*` | [Name] |
| REST API and validation | `src/app/api/*`, [API.md](API.md) | [Name] |
| Guest website (home, rooms, booking, account) | `src/app/*`, `src/components/*` | [Name] |
| Staff dashboard (reservations, rooms, housekeeping, inventory, reports, settings) | `src/app/dashboard/*` | [Name] |
| UI design system and responsiveness | `src/app/globals.css`, `src/components/ui.tsx` | [Name] |
| Invoices, email and CSV export | `src/lib/invoice.ts`, `src/lib/mailer.ts`, `src/lib/csv.ts` | [Name] |
| Automated tests, lint, build | `tests/*`, `eslint.config.mjs`, [TEST_REPORT.md](TEST_REPORT.md) | [Name] |
| Documentation, screenshots, Git/GitHub | `README.md`, `docs/*`, `scripts/take-screenshots.mjs` | [Name] |

## Contribution declaration

| Member | Contribution summary | Signature / date |
|---|---|---|
| [Name] | | |
| [Name] | | |
| [Name] | | |
| [Name] | | |
