# RDRS Monitoring MIS — prototype

Replaces the manual consolidation step in RDRS's monitoring workflow. Monitoring
officers across branches log in and submit activity data directly; the data comes
back out as an Excel workbook in the **exact column format of the existing
Tracking sheet**, plus a dashboard for oversight.

This is a **prototype for internal demonstration**, not a production system. It
is a complete, working build, but it deliberately skips defensive engineering
that a real deployment would need — see [Assumptions](#assumptions-and-deliberate-simplifications).

---

## Quick start

No Docker, no local Postgres server, no signup. The app ships with an embedded
PostgreSQL 16 (PGlite, the WASM build of Postgres) that it uses automatically
when `DATABASE_URL` is not set.

```bash
npm install
cp .env.example .env.local      # optional; everything has a working default
npm run setup                   # apply migrations, then seed from the workbook
npm run seed:demo               # optional: sample entries so the dashboard has data
npm run dev
```

Then open http://localhost:3000. The login screen lists the access codes when
`SHOW_DEMO_CODES=1` is set; otherwise get them from `npm run codes`.

> **`npm run setup` seeds from `data/MIS_Data_Sheet.xlsx`** — the real workbook.
> It creates both projects (SEEDS, ACTB) and all 139 activities, and issues the
> four access codes.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Migrate + seed in one step |
| `npm run db:generate` | Regenerate SQL migrations after a schema change |
| `npm run db:migrate` | Apply pending migrations |
| `npm run seed` | Parse the workbook → projects, activities, access codes |
| `npm run seed:demo` | Insert sample entries (flagged `is_sample`) |
| `npm run seed:demo -- --purge` | Delete all sample entries |
| `npm run extract:headers` | Re-read the Tracking header contract from the workbook |
| `npm run codes` | Print the current access codes (`--json` for scripting) |
| `npm run build` | Production build |

---

## Deploying on Vercel

1. Push the repository to GitHub and import it into Vercel (Hobby plan).
2. In the Vercel dashboard open **Storage → Marketplace → Neon**, and connect it
   to the project. This provisions Postgres on Neon's free tier, billed to the
   existing Vercel account — no separate signup. Vercel injects `DATABASE_URL`
   automatically.
3. Add `SESSION_SECRET` (any long random string — `openssl rand -base64 32`).
   Without it the app falls back to a development secret and warns.
4. Deploy, then run the migration and seed **against the Neon database** once:

   ```bash
   DATABASE_URL="<the Neon connection string>" npm run setup
   ```

   Run this from your machine (or any environment that can reach Neon). The
   deployed app does not seed itself.

The app picks its driver from `DATABASE_URL` at runtime, so the same code runs
against embedded Postgres locally and Neon in production. Nothing else changes.

---

## Roles

There is no email/password signup. Each role is granted by one shared access code
that RDRS hands out. The login form takes **name, designation, branch and access
code**; the code determines the role for that session.

| Role | Can do |
| --- | --- |
| **User** (monitoring officer) | Submit entries for their own branch; view and download their own submissions. Cannot edit after submitting. |
| **View** | Read-only access to all entries across branches and projects; can download. |
| **Admin** | Everything View can do, plus correct any existing entry (the "re-entry" from the meeting notes). Records who corrected it and when. |
| **Superadmin** | Everything Admin can do, plus manage the four access codes and the project/activity master list. |

Permissions live in one place — `src/lib/roles.ts` — as a `can.*` matrix, and
every route and server action checks it. The session cookie is HMAC-signed, so a
user cannot rewrite it to promote themselves.

---

## Screens

| Route | Roles | Purpose |
| --- | --- | --- |
| `/login` | — | Name, designation, branch, access code |
| `/entry` | User | Pick project → activity (reference figures auto-filled, read-only) → date, expenditure, nine beneficiary counts with a live running total. "My submissions" below. |
| `/records` | User (own only), View, Admin, Superadmin | Filterable table (project, branch, date range) + Excel download. Admin/Superadmin also get an edit action. |
| `/records/[id]/edit` | Admin, Superadmin | Correct an entry; records last-edited-by/at |
| `/dashboard` | Admin, Superadmin | Achievement vs target, expenditure over time, demographic breakdown, branch-wise counts |
| `/admin` | Superadmin | Access codes (view/regenerate) and the project/activity master list |

---

## The Excel export

This is the part that has to be exactly right, so it is built to be verifiable
rather than approximate.

`scripts/extract-headers.ts` reads the header row, number formats and column
widths **directly out of the Tracking sheet** and writes them to
`src/lib/generated/tracking-headers.json`. The export consumes that file. The
headers are therefore not retyped anywhere — including the details that look like
mistakes:

- `Varience` (sic) is preserved as-is.
- `Project Name ` and `Annual Target ` keep their **trailing spaces**.
- Number formats come from the sheet (`##,##0`, `dd/mm/yyyy`), so amounts render
  the way the existing workbook renders them.
- Rows 1–2 reproduce the source's stray `Date:` annotation in column I, and the
  header row sits at row 3 exactly as in the source — any downstream parser
  written against this workbook keeps working.

`COL` in `src/lib/tracking-headers.ts` resolves each field to its column **by
exact header text**, so if a future revision of the workbook renames or reorders
a column the app throws at startup instead of silently writing values into the
wrong column.

By default the export is **only** those 31 columns. A second button appends
branch and submitter columns *after* them for internal follow-up — opt-in, so the
default download stays drop-in compatible.

### Columns left blank, and why

The app captures no source for `Last Quarter Target`, `Last Quarter Achievement`,
`Varience` and `Budget`, and the source template leaves them blank too. They are
exported blank rather than filled with zeros.

`Annual Target` and `Annual Budget (BDT)` are **empty for all 139 rows in the
source workbook**. They are carried through as blank rather than invented.

---

## Data model

Four tables (`src/lib/db/schema.ts`):

- **`access_codes`** — role, code, label. One row per role.
- **`projects`** — SEEDS, ACTB.
- **`activities`** — the master list per project: activity code, serial number,
  name, unit type, intervention, activity type, unit rate, project target, project
  budget, annual target, annual budget.
- **`entries`** — mirrors the Tracking sheet: date/month/year, project, activity,
  actual expenditure, the nine beneficiary counts, and a computed `total`.
  Also stores submitter name/designation/branch/role, and last-edited-by/at.

Reference figures (unit type, intervention, activity type, unit rate, targets,
budgets) are **not** duplicated onto entries — they are joined from `activities`
at read time, as the brief specifies.

### Two things worth knowing about the source data

1. **Activity code is not unique per activity.** Every one of the 131 SEEDS rows
   carries the same code, `SEEDS-2024`; the per-activity discriminator is the `sl`
   serial number. Uniqueness is therefore `(project_id, serial_number)`.
2. **The Tracking sheet contains no actual entries.** Rows 4–134 are a blank
   template with only Date/Month/Year/Project pre-filled. So the app's `entries`
   table starts empty — it defines the export *format*, and the real data is
   whatever officers submit. `npm run seed:demo` exists purely so the dashboard
   has something to show in a demo.

---

## Assumptions and deliberate simplifications

Choices made where the brief left room, in the spirit of "simplest reasonable
choice, noted rather than asked".

1. **Embedded Postgres for local dev.** The brief fixes Postgres; provisioning
   Neon requires a Vercel account, so the app also supports PGlite — PostgreSQL 16
   compiled to WebAssembly — when `DATABASE_URL` is absent. Same SQL, same
   migrations, same ORM types. This is what makes the prototype cloneable and
   demoable with zero infrastructure.
2. **Access codes are stored in plaintext.** The Superadmin screen must *display*
   the current code so it can be read out and re-issued; hashing would make that
   impossible. A production build would hash them and show each code once.
3. **Sessions are signed cookies, not a session table.** Tamper-evident, but with
   no revocation or rotation. `SESSION_SECRET` must be set in production.
4. **"My submissions" is scoped by name + branch**, because there are no user
   accounts. Two officers sharing both a name and a branch would see each other's
   rows.
5. **Only the User role submits entries.** Admin and Superadmin correct existing
   rows; the brief gives submission rights to User only.
6. **Master-list edits affect historical exports.** Because reference figures are
   joined live rather than copied onto each entry (as instructed), editing an
   activity changes what past entries report. The UI says so on the edit form.
7. **`Project Name ` is filled with the project name.** The source template leaves
   it blank; filling it is the point of the tool.
8. **`is_sample` column added to `entries`.** Not part of the brief's model — it
   lets the demo data be identified in the UI and purged in one command before
   the prototype meets real submissions.
9. **Dates are anchored at noon UTC** when written to Excel, so the calendar day
   does not shift for anyone in a negative UTC offset.
10. **No pagination.** Explicitly out of scope; the Records table renders every
    matching row.
11. **Embedded Postgres cannot be shared between processes.** A second process
    gets a clear error rather than a corrupt database. Stale locks from killed
    processes are cleaned up automatically.

### Out of scope for this pass (per the brief)

Password reset, email notifications, audit history beyond last-edited-by/at,
pagination polish, mobile app.

---

## Project layout

```
data/MIS_Data_Sheet.xlsx          the source workbook (seed input + export contract)
drizzle/                          generated SQL migrations
scripts/
  extract-headers.ts              workbook -> tracking-headers.json
  seed.ts                         workbook -> projects, activities, access codes
  seed-demo-entries.ts            sample entries for demos
  migrate.ts                      apply migrations to either driver
  list-codes.ts                   print the access codes
src/lib/
  db/schema.ts                    Drizzle schema (4 tables)
  db/index.ts                     dual driver: postgres-js | PGlite
  db/pglite-lock.ts               ownership handling for the embedded database
  auth.ts                         code login, signed session cookie
  roles.ts                        the permission matrix
  entries.ts                      totals, filtered queries, export row projection
  excel.ts                        workbook builder
  tracking-headers.ts             the export contract
  dashboard.ts                    SQL aggregations for the charts
  generated/                      extracted from the workbook - do not hand-edit
src/app/
  login/                          sign in
  (app)/entry/                    new entry + my submissions
  (app)/records/                  records, filters, download
  (app)/records/[id]/edit/        correction (Admin+)
  (app)/dashboard/                charts
  (app)/admin/                    codes + master list (Superadmin)
  api/export/                     Excel download
```

---

## Verification

The build was driven through a real browser against the real production bundle
(`next build` + `next start`), not just type-checked. Verified: login for each of
the four roles, that each role lands on the right screen and is redirected away
from the ones it may not reach, that a submitted entry persists and appears in
"my submissions", that the live total equals the sum of the nine counts, that the
dashboard renders live charts, that an Admin correction is saved and attributed,
that regenerating a code invalidates the previous one, and that the exported
workbook's header row matches the source Tracking sheet byte for byte.

That browser pass is what caught the one bug that a clean type-check and build
both missed: exporting a plain object from a `"use server"` module throws only
when the action is actually invoked.

### Artefacts from that run

- `docs/screenshots/` — the five core screens, captured from the production build
- `docs/sample-export.xlsx` — a real export, for comparing against
  `data/MIS_Data_Sheet.xlsx` yourself

