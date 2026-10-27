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

- **Part 2 — children, families and school years.** School years (one active per group), families with their
  guardians (full name only), children (name, surnames, optional birth date) and their section per year. Add,
  edit, change section or family, reversible "leaves this year" and admin-only permanent deletion. A Children
  screen with search (accent-insensitive), section filters and grouped list; a family sheet with guardians and
  siblings across sections. Scouters only see the children of their sections and cannot open family sheets.
- **Import of the group roster** in a 3-step wizard: upload (the file is read in memory and never stored),
  assign a section to each block and pick the school year, review the proposed families (siblings across
  blocks, typo-merged families, children without guardians, already existing children) and confirm all at once.
  Re-importing recognises existing children and families and only updates their section. CSV files are read in
  UTF-8 or Windows-1252.

### Fixed
- User-facing API messages now use proper Spanish spelling (contraseña, sesión, sección…).
- The development proxy keeps the `Host` header, so the CSRF origin check behaves as it does behind nginx.
