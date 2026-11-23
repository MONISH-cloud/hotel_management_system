# Technology Justification

| Layer | Choice | Why it fits a hotel system |
|---|---|---|
| UI | **Next.js 16 (App Router) + React 19 + TypeScript** | Server Components render rooms, availability and dashboards straight from the database with no client waterfalls; route handlers give a typed REST API in the same codebase; the proxy layer protects routes by role |
| Styling | **Tailwind CSS 4 + Framer Motion** | A token-based design system (gold/ink palette, serif display type) and physics-based motion give a premium feel without a heavy component library |
| Core database | **MySQL 8 (InnoDB)** | Bookings, payments and inventory are *transactional, relational and rule-heavy*. InnoDB gives ACID transactions, row-level locks (`SELECT … FOR UPDATE` to stop double-booking), foreign keys, CHECK constraints, triggers, stored routines, CTEs/window functions and native roles, all needed here |
| Graph database | **Neo4j** | Reviews and recommendations are about *connections*: Guest → Review → RoomType, Guest → Service. "Guests who stayed where you stayed also ordered…" is a two-hop traversal in Cypher but a heavy multi-join in SQL |
| Key-value store | **Redis** | Sessions, permission cache, availability cache, rate limiting and the live feed need sub-millisecond access with automatic expiry (TTL). Putting them in MySQL would add write load to the system of record |
| Auth | **bcrypt + signed JWT (jose) + Redis session registry** | Stateless verification at the edge, but revocable: logout and role changes delete the Redis session key |

## Why polyglot persistence instead of one database?

Each store does what it is best at, and **MySQL remains the single source of truth**. Neo4j and Redis hold derived or ephemeral data (reviews are the one exception and live only in Neo4j by design). If Neo4j or Redis is down the site keeps working: every helper in `src/lib/graph.ts` and `src/lib/cache.ts` degrades to an empty result.

## Security decisions

* Passwords: bcrypt (cost 10); never logged or returned.
* JWT in an `httpOnly`, `sameSite=lax` cookie; `secure` in production.
* RBAC in two layers: application permissions from `roles → role_permissions → permissions` (checked in every route handler and page), plus MySQL-engine roles/grants.
* Login brute-force protection: Redis counter, 8 attempts / 10 minutes per IP + email.
* All SQL uses parameter placeholders; input validated with Zod; MySQL `SIGNAL` errors are surfaced as clean 400 messages.
* Guests can only read or change reservations whose `guest_id` matches their own profile.
