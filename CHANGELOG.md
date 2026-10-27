# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/). Versions before 1.0.0 are **betas**: interfaces and data models may
still change.

## [Unreleased]

### Added
- Project proposal and decision log (`docs/`), and the Python prototype that validated the idea (`prototipo/`).
- **Part 0 — skeleton.** npm workspaces with the API (`backend`: Express, Prisma, Zod, `/api/health` that also
  checks the database) and the web (`apps/web`: React, Vite, Tailwind with the chosen theme and self-hosted
  fonts, a "System status" screen).
- One Docker image carries the API and the built web; the web is served by a non-root, read-only nginx that
  proxies `/api` to the API, with a strict CSP (no inline scripts) and every security header sent once.
- CI on every pull request: lint, typecheck, build, tests with coverage, and the image started under
  production restrictions with end-to-end checks (web → API → database).
- `pre` environment for the home server (`deploy/pre/`): compose file, nginx site and a step-by-step guide.
- Dependabot targeting `pre`.
- **Part 1 — groups, users and sections (API).** Groups with their default sections; users that can belong to
  several groups with a role in each (Admin, Treasury, Scouter); email and password sign-in (argon2id, 5 failed
  attempts lock the email for 15 minutes) with server-side sessions in an `httpOnly` cookie; single-use invitation
  links (7 days) and admin-generated password reset links (24 hours, closing every open session); section
  management (create, rename, archive, reorder); CSRF protection by origin; server commands `crear-grupo` and
  `restablecer`. Every query is scoped to the active group, with tests that try to cross groups.
- **Part 1 — screens.** Sign-in, invitation (new or existing account) and password reset pages on a centred
  card; header with the active group always visible and a menu to switch groups; user menu; bottom navigation
  on phones; Settings with People (invite with Copy/Share link, change role and sections, password reset link,
  remove), Sections (create, rename, colour, archive, reorder with accessible up/down buttons) and My account
  (details, change password, sign out). A "no group" screen for people removed from their group. React Router,
  TanStack Query, React Hook Form + Zod and Radix primitives styled with the project theme.
- Users can change their own password (current password required; other sessions are closed).

### Fixed
- User-facing API messages now use proper Spanish spelling (contraseña, sesión, sección…).
- The development proxy keeps the `Host` header, so the CSRF origin check behaves as it does behind nginx.
