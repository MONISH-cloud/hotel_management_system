# Operations Runbook

Day-to-day running, backups and recovery. Everything here uses scripts already in the repository.

## 1. Start and stop

| | macOS (Homebrew) | Docker |
|---|---|---|
| Start databases | `brew services start mysql redis neo4j` | `docker start ma-mysql ma-redis ma-neo4j` |
| Stop databases | `brew services stop neo4j redis mysql` | `docker stop ma-neo4j ma-redis ma-mysql` |
| Start the app | `npm run dev` (development) or `npm run build && npm start` | same |
| Health check | `curl localhost:3000/api/health` → `{"status":"ok","mysql":true,"redis":true,"neo4j":true}` | same |

Start the databases **before** the app. If Neo4j or Redis is down the site still works, but reviews, recommendations, caching and live feed are unavailable (check **Dashboard → Activity & health**).

## 2. What lives where, and what to back up

| Data | Store | Back up? | Rebuilt by the seed scripts? |
|---|---|---|---|
| Bookings, payments, guests, rooms, settings, accounts, audit log | **MySQL** | **Yes, always** | `db:setup` **drops and recreates it** |
| **Guest reviews** | **Neo4j only** | **Yes: exists nowhere else** | `db:seed-nosql` **deletes the whole graph** and re-seeds sample reviews |
| Sessions, caches, wishlist, live feed | Redis | No (ephemeral) | `db:seed-nosql` clears the `ma:*` keys |
| Uploaded room photos | `uploads/` folder | Copy the folder | No |
| Secrets | `.env.local` | Keep a private copy | No |

> ⚠️ **`npm run db:all`, `db:setup` and `db:seed-nosql` are for first-time set-up and demos.** Run against a live system they erase real data. **Take a backup first.**

## 3. Backup

```bash
npm run db:backup
```
Creates, in `backups/` (git-ignored; contains guest data, so keep it private):

| File | Contents |
|---|---|
| `maison_aurelia-<timestamp>.sql` | All tables and data, stored procedures, functions, triggers, views |
| `reviews-<timestamp>.json` | Every review with its reply, rating and dates |

Needs `mysqldump` on the PATH (or set `MYSQLDUMP_PATH`) and, for reviews, Neo4j running. If Neo4j is unreachable the script says so and still saves MySQL.

**Schedule it** (macOS/Linux crontab, daily at 02:30):
```cron
30 2 * * * cd /path/to/hotel_management_system && /usr/bin/env npm run db:backup >> backups/backup.log 2>&1
```
Copy the `backups/` folder off the machine regularly.

## 4. Restore

```bash
# 1. MySQL (refuses to overwrite an existing, non-empty database unless you add --yes)
npm run db:restore -- backups/maison_aurelia-<timestamp>.sql --database=maison_aurelia --yes

# 2. Rebuild the graph (guests, stays, orders) from the restored MySQL data
npm run db:seed-nosql

# 3. Put the real reviews back (replaces the sample reviews that step 2 created)
npm run db:restore -- --reviews=backups/reviews-<timestamp>.json --replace-reviews
```

**Practise on a copy first:** restore into a scratch database and compare, without touching the live one:
```bash
npm run db:restore -- backups/maison_aurelia-<timestamp>.sql --database=maison_aurelia_check
mysql -uroot -e "DROP DATABASE maison_aurelia_check"      # when finished
```
Import of reviews without `--replace-reviews` is a safe **merge** (matched by id, repeatable).

**Verified behaviour** (tested on a real backup): 23 tables, 15 routines, 9 triggers restored; row counts and table checksums identical to the original (22 of 23 byte-identical; the audit log differs only in that MySQL re-serialises JSON decimals as `19040.0` instead of `19040.00`, which is numerically the same). The restored database answers `fn_has_permission`, `v_reservation_details` and the occupancy procedure correctly.

## 5. Configuration and secrets

| Variable | Purpose |
|---|---|
| `MYSQL_PASSWORD` | Password of the application's MySQL user (`hotel_app`) |
| `MYSQL_ROOT_PASSWORD` | Used only by the setup, test, backup and restore scripts |
| `NEO4J_PASSWORD` | Neo4j login |
| `JWT_SECRET` | Signs session cookies (32+ characters) |
| `MYSQL_ALLOW_ANY_HOST=1` | Only if MySQL runs in Docker/WSL |
| `SMTP_*`, `MAIL_FROM`, `APP_URL` | Optional: real email delivery and absolute links |

**Rotating `JWT_SECRET`** signs everyone out (all existing cookies become invalid). **Changing a user's role or password** revokes that user's live sessions automatically. The app refuses to start while any value still starts with `change-me`.

## 6. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `/api/health` shows `"mysql": false` | MySQL not running or wrong `MYSQL_PASSWORD`. Start it; check `.env.local`. |
| `"neo4j": false` | Neo4j still starting (takes 30–90 s) or password mismatch. Reviews/recommendations are hidden meanwhile. |
| `"redis": false` | Redis stopped. Sessions still validate by signature, but logout revocation and caching pause. |
| "Environment variable … is not set to a real value" | A `change-me…` placeholder remains in `.env.local`. |
| `Access denied for user 'hotel_app'` with Docker | Add `MYSQL_ALLOW_ANY_HOST=1` and re-run `npm run db:setup`. |
| A booking fails with "Room is not available" / "Not enough rooms" | Working as designed: the database refused a double booking. |
| Page shows the "unexpected snag" screen | A server error; read the terminal for the matching `digest` reference. |
| Cannot check a guest out | The balance is not settled. Take the payment first. |
| Emails are not arriving | No `SMTP_*` set: read them under **Dashboard → Activity → Email outbox**. |

## 7. Tests before and after changes

```bash
npm test          # 20 database-rule tests on a throw-away database
npm run lint && npm run typecheck
```
