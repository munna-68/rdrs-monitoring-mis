# RDRS Monitoring MIS — project notes

## What this is
Prototype web app replacing RDRS's manual Excel consolidation step. Monitoring
officers submit activity data; it exports back out in the existing Tracking
sheet's exact column format, plus an Admin/Superadmin dashboard.

Stack: Next.js 15 App Router + TypeScript + Tailwind v4, Drizzle ORM, Postgres,
exceljs, recharts. Deploys on Vercel Hobby.

## Conventions established in this project

- **Postgres is the database, always.** `DATABASE_URL` present → `postgres-js`
  (Neon, provisioned from Vercel's Storage/Marketplace tab). Absent → PGlite
  (Postgres 16 in WASM) at `./.pglite-data`, so the repo runs with zero setup.
  Never introduce SQLite or a non-Postgres fallback.
- **The workbook is the source of truth for the export format.**
  `scripts/extract-headers.ts` reads the Tracking header row, number formats and
  column widths out of `data/MIS_Data_Sheet.xlsx` into
  `src/lib/generated/tracking-headers.json`. Never retype those headers by hand,
  and never "fix" `Varience` or the trailing spaces in `Project Name ` /
  `Annual Target ` — they are intentional fidelity.
- **Column mapping is by exact header text** (`COL` in
  `src/lib/tracking-headers.ts`), so a renamed/reordered source column throws at
  startup instead of silently shifting values one cell left.
- **Reference figures are joined from `activities`, never copied onto entries.**
  Per the brief. Consequence: editing the master list changes what historical
  entries report — the UI says so.
- **`total` is always computed** via `computeTotal()`, never entered.
- **A `"use server"` module may only export async functions.** State types and
  initial values go in `src/lib/action-state.ts`. Violating this throws only at
  runtime, as an opaque "Application error".
- **Permissions live only in `src/lib/roles.ts`** as the `can.*` matrix. Every
  route and server action checks it; don't scatter role checks.
- **Sample data must stay separable.** `entries.is_sample` flags demo rows;
  `npm run seed:demo -- --purge` removes them.

## Verification approach
The user values working verification over plausible-looking code. The standard
here is: `next build` + `next start`, driven through real Chrome over CDP, plus
byte-level comparison of the Excel export against the source workbook. A clean
type-check and build is not sufficient — the `"use server"` bug passed both and
only failed at runtime.
