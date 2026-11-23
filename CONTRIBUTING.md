# Contributing

Thanks for helping improve Maison Aurelia. This guide keeps changes safe: the database enforces the hotel's business rules, so a careless change can break bookings.

## Set up
Follow **Quick start** in the [README](README.md). You need MySQL, Redis and Neo4j running, a `.env.local` with real (non-placeholder) values, and `npm run db:all` once.

## Workflow
1. **Branch from `main`**: `feat/…`, `fix/…`, `docs/…`, `test/…` or `chore/…`.
2. Make a small, focused change. One idea per pull request.
3. Run the checks (all must pass):
   ```bash
   npm run typecheck && npm run lint && npm test
   npm run build
   ```
4. Open a pull request using the template. Explain **what, why and how you verified it**.
5. Keep `main` working: don't merge with failing checks.

## Rules of thumb
| Do | Don't |
|---|---|
| Put pricing, availability, refund and permission rules in **MySQL** (procedures, triggers, `hotel_settings`) | Re-implement a business rule in a route or component |
| Add a test for every rule you add or change (`tests/booking.test.mjs` for database rules) | Weaken or delete a test to make it pass |
| Use parameterised queries and validate input with Zod | Build SQL with string concatenation |
| Check permissions with `requirePerm(...)` in every new API route | Rely on hiding a button as protection |
| Read configuration through `requireEnv` | Add a default password or secret anywhere |
| Change the schema with a new SQL migration and update `docs/DATA_DICTIONARY.md` (`npm run docs:dictionary`) | Edit tables in the database by hand |
| Keep changes **additive** where you can | Rename tables or columns without updating every query and test |

## Database changes
- Base tables live in `db/mysql/01_schema.sql`; later changes are `ALTER TABLE` statements in `db/mysql/01b_alter_tables.sql`.
- Routines and triggers are in `02_routines.sql`. They run inside `START TRANSACTION … COMMIT` with a rollback handler: keep that pattern.
- After a schema change run `npm run docs:dictionary`; it **fails if a new column has no description**, which keeps the docs honest.

## Commit messages
Conventional style, present tense: `feat(db): …`, `fix(api): …`, `docs: …`, `test: …`, `chore: …`.

## Reporting problems
Use the issue templates. For security problems read [SECURITY.md](SECURITY.md) first and **do not** open a public issue.
