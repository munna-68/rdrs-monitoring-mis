/**
 * Seeds the database from data/MIS_Data_Sheet.xlsx.
 *
 * Parses the real workbook rather than any hand-typed sample data:
 *   - "Annual Target"  -> the SEEDS project's full activity list (~131 rows)
 *   - "Monthly Target" -> the ACTB project's activity list (8 rows)
 *   - "Tracking"       -> the export header contract (via extractHeaders)
 *
 * Idempotent: re-running updates projects/activities in place and leaves
 * existing access codes alone (so codes already handed out keep working).
 *
 * Run with:  npm run seed
 */
import ExcelJS from 'exceljs';
import { getDb, schema } from '../src/lib/db';
import { generateCode } from '../src/lib/codes';
import { sql } from 'drizzle-orm';
import {
  WORKBOOK_PATH,
  cellToDate,
  cellToNumber,
  cellToText,
  extractHeaders,
} from './extract-headers';

type ParsedActivity = {
  activityCode: string;
  serialNumber: number;
  name: string;
  unitType: string | null;
  intervention: string | null;
  activityType: string | null;
  unitRate: number | null;
  projectTarget: number | null;
  projectBudget: number | null;
  annualTarget: number | null;
  annualBudget: number | null;
};

/** Header aliases — the two sheets word a couple of columns slightly differently. */
const ALIASES = {
  project: ['Project'],
  activityCode: ['Activity Code'],
  serial: ['sl', 'SL', 'Sl'],
  name: ['Project Activity', 'Project Activities'],
  unitType: ['Unit Type'],
  intervention: ['Intervention'],
  activityType: ['Activity Type'],
  unitRate: ['Unit Rate (BDT)'],
  projectTarget: ['Project Target'],
  projectBudget: ['Project Budget (BDT)'],
  annualTarget: ['Annual Target', 'Annual Target '],
  annualBudget: ['Annual Budget (BDT)', 'Annual Budget (BDT) (July 2023-June 2024)'],
} as const;

type ColMap = Record<keyof typeof ALIASES, number | null>;

/** Find the header row by content and map our field names onto its columns. */
function mapColumns(ws: ExcelJS.Worksheet): { headerRow: number; cols: ColMap } {
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const texts: string[] = [];
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      texts[col - 1] = cellToText(cell.value).trim();
    });
    if (texts[0] !== 'Date' || !texts.includes('Activity Code')) continue;

    const cols = {} as ColMap;
    for (const [field, names] of Object.entries(ALIASES) as [keyof ColMap, readonly string[]][]) {
      const idx = texts.findIndex((t) => names.some((n) => n.trim() === t));
      cols[field] = idx === -1 ? null : idx + 1;
    }
    return { headerRow: r, cols };
  }
  throw new Error(`Could not locate a header row in sheet "${ws.name}".`);
}

function parseActivities(ws: ExcelJS.Worksheet, projectName: string): ParsedActivity[] {
  const { headerRow, cols } = mapColumns(ws);
  const out: ParsedActivity[] = [];
  const seen = new Set<number>();

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (c: number | null) => (c ? row.getCell(c).value : null);

    const serialRaw = get(cols.serial);
    const serial = cellToNumber(serialRaw);
    const name = cellToText(get(cols.name)).trim();
    const code = cellToText(get(cols.activityCode)).trim();

    // A row counts as a real activity if it has a serial AND a name.
    if (serial === null || !name) continue;
    if (seen.has(serial)) continue; // guard against duplicated template rows
    seen.add(serial);

    out.push({
      activityCode: code || projectName,
      serialNumber: serial,
      name,
      unitType: cellToText(get(cols.unitType)).trim() || null,
      intervention: cellToText(get(cols.intervention)).trim() || null,
      activityType: cellToText(get(cols.activityType)).trim() || null,
      unitRate: cellToNumber(get(cols.unitRate)),
      projectTarget: cellToNumber(get(cols.projectTarget)),
      projectBudget: cellToNumber(get(cols.projectBudget)),
      annualTarget: cellToNumber(get(cols.annualTarget)),
      annualBudget: cellToNumber(get(cols.annualBudget)),
    });
  }
  return out;
}

const ROLE_SEED: { role: 'USER' | 'VIEW' | 'ADMIN' | 'SUPERADMIN'; label: string }[] = [
  { role: 'USER', label: 'Monitoring officer — branch data entry' },
  { role: 'VIEW', label: 'Read-only — programme / M&E review' },
  { role: 'ADMIN', label: 'Admin — corrections and re-entry' },
  { role: 'SUPERADMIN', label: 'Superadmin — codes and master list' },
];

async function main() {
  console.log(`Reading ${WORKBOOK_PATH}`);
  const db = await getDb();

  // 1. Refresh the export header contract from the Tracking sheet.
  const headers = await extractHeaders();
  console.log(`  Tracking header contract: ${headers.length} columns`);

  // 2. Parse the two activity sheets.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);

  const sheets: { sheet: string; project: string }[] = [
    { sheet: 'Annual Target', project: 'SEEDS' },
    { sheet: 'Monthly Target', project: 'ACTB' },
  ];

  const parsed = sheets.map(({ sheet, project }) => {
    const ws = wb.getWorksheet(sheet);
    if (!ws) throw new Error(`Workbook has no "${sheet}" sheet.`);
    const rows = parseActivities(ws, project);
    console.log(`  ${sheet}: ${rows.length} activities -> project ${project}`);
    return { project, rows };
  });

  // 3. Projects.
  for (const { project, rows } of parsed) {
    const sample = rows[0];
    if (!sample) continue;
    await db
      .insert(schema.projects)
      .values({ name: project, code: sample.activityCode })
      .onConflictDoUpdate({
        target: schema.projects.name,
        set: { code: sample.activityCode },
      });
  }

  const projectRows = await db.select().from(schema.projects);
  const idByName = new Map(projectRows.map((p) => [p.name, p.id]));

  // 4. Activities (upsert on the project+serial uniqueness we defined).
  let inserted = 0;
  for (const { project, rows } of parsed) {
    const projectId = idByName.get(project);
    if (!projectId) throw new Error(`Project ${project} missing after insert.`);
    for (const a of rows) {
      await db
        .insert(schema.activities)
        .values({ projectId, ...a })
        .onConflictDoUpdate({
          target: [schema.activities.projectId, schema.activities.serialNumber],
          set: {
            activityCode: a.activityCode,
            name: a.name,
            unitType: a.unitType,
            intervention: a.intervention,
            activityType: a.activityType,
            unitRate: a.unitRate,
            projectTarget: a.projectTarget,
            projectBudget: a.projectBudget,
            annualTarget: a.annualTarget,
            annualBudget: a.annualBudget,
            updatedAt: new Date(),
          },
        });
      inserted++;
    }
  }
  console.log(`  Upserted ${inserted} activities`);

  // 5. Access codes — only create the ones that don't exist yet.
  for (const { role, label } of ROLE_SEED) {
    await db
      .insert(schema.accessCodes)
      .values({ role, label, code: generateCode(role) })
      .onConflictDoNothing({ target: schema.accessCodes.role });
  }

  const codes = await db.select().from(schema.accessCodes);
  const [{ n: activityCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.activities);

  console.log(`\nDatabase ready: ${projectRows.length} projects, ${activityCount} activities.\n`);
  console.log('Access codes (share these with the relevant staff):');
  for (const c of codes.sort((a, b) => ROLE_SEED.findIndex((r) => r.role === a.role) - ROLE_SEED.findIndex((r) => r.role === b.role))) {
    console.log(`  ${c.role.padEnd(11)} ${c.code}   ${c.label}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('\nSeed failed:\n', e);
  process.exit(1);
});
