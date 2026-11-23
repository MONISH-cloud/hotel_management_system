# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
Pull requests open at the time of writing (see the repository's *Pull requests* tab for status):

### Added
- **CI**: GitHub Actions pipeline running type-check, lint, the 20 database tests (MySQL service) and the production build. (#8)
- **Error pages**: branded 404 and error screens; dashboard error boundary that keeps the sidebar. (#9)
- **Security**: browser security headers and a cross-site request guard for state-changing API calls. (#10)
- **API test suite**: 73 end-to-end tests run against an isolated copy of the stack (`npm run test:api`). (#11)
- **Operations**: `db:backup` / `db:restore` (MySQL dump plus Neo4j reviews export), operations runbook, `CONTRIBUTING.md`, `SECURITY.md`, issue and pull-request templates.

## [1.0.0]: first release
Delivered as pull requests #1 to #7.

### Added
- **Database**: 23 MySQL tables with constraints, `ALTER TABLE` migration, 6 functions, 9 stored procedures, 9 triggers, 2 views, 16 analytical queries, native database roles.
- **NoSQL**: Neo4j graph (reviews, stays, orders, recommendations) and Redis (sessions, caches, rate limits, wishlist, live feed).
- **Backend**: authentication, role-based access control and 40 REST routes: bookings (single and multi-room), modification, cancellation with refund rules, payments (simulated), PDF invoices, inventory with photo upload, email outbox, CSV export.
- **Guest site**: availability search, booking, account, loyalty, reviews, wishlist, recommendations.
- **Staff dashboard**: 10 role-aware screens including live SQL reports, inventory, settings and audit log.
- **Quality**: 20 automated tests, ESLint, strict TypeScript, 13 documents, narrated walkthrough video.
