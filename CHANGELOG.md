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

- **Part 3 — events and charges.** Events of two kinds (whole section, or only the children signed up) with
  dates, a price per section and optional sibling prices (1st pays the section price, fixed prices for the 2nd and
  the 3rd onwards, never above the section price). Each child gets a charge; amounts are stored in cents. Charges
  follow the roster on their own: new children in an open event get theirs, leavers' unpaid charges are cancelled,
  and sibling positions are recalculated (if the eldest leaves, the next one pays the full price). Changing prices
  recalculates unpaid charges and keeps manual adjustments. Per-child adjustments with an optional reason (hidden
  from scouters), removing a child from an event and adding them back. Screens: event list with collected
  progress, event detail grouped by section with status filters, and a single-page form to create and edit.

- **Part 4 — bank movements and automatic classification.** Import the bank's movements Excel in two steps
  (analyse, then confirm; the file is never stored). Only incoming payments are kept (date, payer name, amount);
  outgoing ones are counted and ignored. Movements already imported are recognised by the bank's movement number,
  so overlapping periods can be uploaded. A payment is classified on its own only when the family is certain
  (learned payer, or first name and every surname of a guardian) and exactly one combination of that family's
  pending charges in the current school year adds up to the amount; everything else goes to Doubts with the reason
  and the best suggestion. Any classification can be undone. A new Movements tab (Admin and Treasury only) with
  Doubts / Classified lists; events now show what has been collected, and the family sheet shows each child's
  charges and the payments received.
- "Pagado" marks in the roster: when re-importing it, each column with marks can be linked to an event and every
  mark becomes a payment for what that charge still owes. A later bank payment that no longer fits is flagged as
  possibly already marked.
- Charges with payments are protected: they keep their amount when prices change, are not cancelled when the child
  leaves, cannot be removed from the event or adjusted below what has been paid, and block deleting the event, the
  child or the family.

- **Part 5 — Doubts, learning and manual payments.** Each doubt opens as a bank receipt with its reason, and is
  resolved by splitting it among the pending charges of one family (search by child), with partial payments
  allowed; whatever is not split becomes the family's balance, which can later be applied to a pending charge from
  the family sheet. "Remember this payer" learns the bank name for that family and retries that payer's other
  doubts. Income that does not belong to any family can be filed as "Other income" with a note. Payments can be
  recorded by hand (date, payer, amount, cash/Bizum/transfer/other) with the same split. A bank payment that may be
  one already recorded by hand or marked in the roster goes to Doubts, and "It's the same payment" links both so
  nothing is counted twice; undoing restores everything. The home screen shows how many doubts are waiting, and the
  family sheet shows its balance and learned payers (which can be forgotten).

### Fixed
- User-facing API messages now use proper Spanish spelling (contraseña, sesión, sección…).
- The development proxy keeps the `Host` header, so the CSRF origin check behaves as it does behind nginx.
