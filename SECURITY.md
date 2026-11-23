# Security Policy

## Reporting a vulnerability
Please **do not** open a public issue for security problems.

Use GitHub's private reporting: **Security tab → "Report a vulnerability"** on this repository, or contact the maintainer [@MONISH-cloud](https://github.com/MONISH-cloud) directly. Include what you found, how to reproduce it, and the impact. You will get an acknowledgement as soon as the maintainer can respond.

## What is already in place
- Passwords hashed with **bcrypt**; sessions are signed JWTs **registered in Redis** so logout, role change and password reset revoke them immediately.
- **Role-based access control** stored in MySQL and checked on every page and API route; the database also enforces its own rules (constraints, triggers, procedures).
- **Parameterised SQL** everywhere; input validated with Zod; file uploads are accepted only if the **file bytes** are a JPEG, PNG or WebP (max 4 MB).
- **Login, registration and password-reset rate limiting**; single-use, **hashed**, expiring tokens for password reset and email verification; password-reset answers never reveal whether an email has an account.
- **No fallback secrets**: the application refuses to start while `.env.local` still contains placeholders.
- The application's MySQL account is **localhost-only by default**.
- CSV exports neutralise spreadsheet-formula injection.

## Known limitations (be aware when deploying)
- The demo accounts and their shared password (`Password@123`) exist so the project can be evaluated. **Disable them before any real deployment**: turn off *Show demo accounts* in Dashboard → Settings and change or remove those users.
- Payments are **simulated**; no card data is processed or stored.
- Email is delivered only when SMTP is configured.
- Uploaded photos are stored on local disk.
- Serve the site over **HTTPS** in production (the app sets HSTS only when running in production mode).
- Keep `.env.local` out of version control (it is git-ignored) and rotate `JWT_SECRET` and database passwords if they are ever exposed.

## Supported versions
Only the latest commit on `main` is supported.
