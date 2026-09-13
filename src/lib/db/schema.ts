import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Roles are granted purely by shared access code — there is no signup.
 * See `AccessCodes` below and `src/lib/roles.ts` for the permission matrix.
 */
export const roleEnum = pgEnum('role', ['USER', 'VIEW', 'ADMIN', 'SUPERADMIN']);

/* ------------------------------------------------------------------ *
 * AccessCodes
 * One row per role. RDRS hands the code out; whoever holds it logs in
 * with that role for the session.
 *
 * PROTOTYPE NOTE: codes are stored in plaintext (not hashed) because the
 * Superadmin screen is required to *display* the current code so it can
 * be read out and re-issued. Hashing would make that screen impossible.
 * In a production system these would be hashed and shown only once.
 * ------------------------------------------------------------------ */
export const accessCodes = pgTable('access_codes', {
  id: serial('id').primaryKey(),
  role: roleEnum('role').notNull(),
  code: text('code').notNull(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('access_codes_role_key').on(t.role),
  uniqueIndex('access_codes_code_key').on(t.code),
]);

/* ------------------------------------------------------------------ *
 * Projects  (SEEDS, ACTB, ...)
 * ------------------------------------------------------------------ */
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_name_key').on(t.name),
]);

/* ------------------------------------------------------------------ *
 * Activities — the master activity list per project, sourced verbatim
 * from the workbook's "Annual Target" (SEEDS) and "Monthly Target"
 * (ACTB) sheets.
 *
 * NOTE ON UNIQUENESS: in the source workbook every SEEDS row carries the
 * same Activity Code ("SEEDS-2024"); the per-activity discriminator is
 * the `sl` serial number. So uniqueness is (project, serialNumber), not
 * activityCode.
 * ------------------------------------------------------------------ */
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  activityCode: text('activity_code').notNull(),
  serialNumber: integer('serial_number').notNull(),
  name: text('name').notNull(),
  unitType: text('unit_type'),
  intervention: text('intervention'),
  activityType: text('activity_type'),
  unitRate: numeric('unit_rate', { precision: 14, scale: 2, mode: 'number' }),
  projectTarget: numeric('project_target', { precision: 14, scale: 2, mode: 'number' }),
  projectBudget: numeric('project_budget', { precision: 14, scale: 2, mode: 'number' }),
  // Blank in the source workbook for every row — carried through as nullable
  // so the export reproduces the source faithfully rather than inventing zeros.
  annualTarget: numeric('annual_target', { precision: 14, scale: 2, mode: 'number' }),
  annualBudget: numeric('annual_budget', { precision: 14, scale: 2, mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('activities_project_serial_key').on(t.projectId, t.serialNumber),
  index('activities_project_idx').on(t.projectId),
]);

/* ------------------------------------------------------------------ *
 * Entries — mirrors the workbook's "Tracking" sheet.
 *
 * The reference columns (unit type / intervention / activity type / unit
 * rate / targets / budgets) are deliberately NOT duplicated here; they are
 * joined from `activities` at read time, as the brief specifies. The
 * submitter identity and branch are captured at login and stored per row.
 *
 * `total` is stored rather than computed on read so the export and the
 * dashboard agree even if the beneficiary columns are ever edited
 * directly. It is always written by `computeTotal()` — never by hand.
 * ------------------------------------------------------------------ */
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),

  // Date triple, mirroring Tracking columns A/B/C. Month and year are
  // derived from entryDate on write so they can never drift apart.
  entryDate: date('entry_date').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),

  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'restrict' }),
  activityId: integer('activity_id').notNull().references(() => activities.id, { onDelete: 'restrict' }),

  actualExpenditure: numeric('actual_expenditure', { precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),

  // The nine beneficiary breakdown counts.
  female26: integer('female_26').notNull().default(0),
  male26: integer('male_26').notNull().default(0),
  pwd26: integer('pwd_26').notNull().default(0),
  youthFemale: integer('youth_female_15_25').notNull().default(0),
  youthMale: integer('youth_male_15_25').notNull().default(0),
  youthPwd: integer('youth_pwd_15_25').notNull().default(0),
  girl: integer('girl_0_14').notNull().default(0),
  boy: integer('boy_0_14').notNull().default(0),
  pwd14: integer('pwd_0_14').notNull().default(0),

  // Sum of the nine above. Computed by computeTotal() on every write.
  total: integer('total').notNull().default(0),

  // Who submitted it — captured at login, denormalised onto the row.
  submittedByName: text('submitted_by_name').notNull(),
  submittedByDesignation: text('submitted_by_designation').notNull(),
  branch: text('branch').notNull(),
  submittedByRole: roleEnum('submitted_by_role').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  /**
   * Marks rows created by `npm run seed:demo`. Not part of the brief's data
   * model — added so the sample data used to demonstrate the dashboard can be
   * identified in the UI and purged in one step (`npm run seed:demo -- --purge`)
   * before the prototype is pointed at real submissions. Always false for
   * anything an officer actually submits.
   */
  isSample: boolean('is_sample').notNull().default(false),

  // "Re-entry" / correction audit — last editor only, per the brief's
  // explicit scope limit (no full audit-log history this pass).
  lastEditedByName: text('last_edited_by_name'),
  lastEditedByDesignation: text('last_edited_by_designation'),
  lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),
}, (t) => [
  index('entries_project_idx').on(t.projectId),
  index('entries_branch_idx').on(t.branch),
  index('entries_date_idx').on(t.entryDate),
]);

/* ----------------------------- relations ----------------------------- */

export const projectsRelations = relations(projects, ({ many }) => ({
  activities: many(activities),
  entries: many(entries),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  project: one(projects, { fields: [activities.projectId], references: [projects.id] }),
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  project: one(projects, { fields: [entries.projectId], references: [projects.id] }),
  activity: one(activities, { fields: [entries.activityId], references: [activities.id] }),
}));

export type AccessCode = typeof accessCodes.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
