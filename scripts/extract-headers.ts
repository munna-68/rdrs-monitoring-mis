/**
 * Extracts the "Tracking" sheet's header row from the source workbook and
 * writes it to src/lib/generated/tracking-headers.json.
 *
 * WHY THIS EXISTS
 * The brief is explicit: the Tracking sheet's header row "is the exact column
 * set and order the app's Excel export must reproduce ... treat it as the
 * source of truth for the export format rather than retyping the headers from
 * scratch."
 *
 * So we don't retype them. We read them off the sheet once, at seed time, and
 * commit the result. The export then consumes that generated file, which means
 * the exported header row is byte-identical to the source — including the
 * inconsistent spelling ("Varience") and the trailing spaces in
 * "Project Name " and "Annual Target ".
 *
 * Re-run with:  npm run extract:headers
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

export const WORKBOOK_PATH = path.join(process.cwd(), 'data', 'MIS_Data_Sheet.xlsx');
export const HEADERS_OUT = path.join(
  process.cwd(),
  'src', 'lib', 'generated', 'tracking-headers.json',
);

/** Locate the Tracking header row by content, not by a hard-coded row number. */
export function findHeaderRow(ws: ExcelJS.Worksheet): { rowNumber: number; headers: string[] } {
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const row = ws.getRow(r);
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellToText(cell.value);
    });
    const hasDate = values[0] === 'Date';
    const hasTotal = values.includes('Total');
    if (hasDate && hasTotal) {
      // Trim trailing blanks that are formatting artefacts, not real columns.
      let last = values.length - 1;
      while (last >= 0 && (values[last] ?? '') === '') last--;
      return { rowNumber: r, headers: values.slice(0, last + 1) };
    }
  }
  throw new Error('Could not locate a Tracking header row (expected "Date" in col A and "Total").');
}

export function cellToText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;            // rich text / hyperlink
    if (typeof o.result !== 'undefined') return cellToText(o.result as ExcelJS.CellValue); // formula
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((p) => p.text).join('');
    }
  }
  return String(v);
}

export function cellToNumber(v: ExcelJS.CellValue): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = cellToText(v).trim();
  if (s === '' || s === '#N/A' || s === '-') return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function cellToDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v;
  const s = cellToText(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function extractHeaders(): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);
  const ws = wb.getWorksheet('Tracking');
  if (!ws) throw new Error('Workbook has no "Tracking" sheet.');
  const { rowNumber, headers } = findHeaderRow(ws);
  fs.mkdirSync(path.dirname(HEADERS_OUT), { recursive: true });
  fs.writeFileSync(
    HEADERS_OUT,
    JSON.stringify({ sourceSheet: 'Tracking', sourceRow: rowNumber, headers }, null, 2) + '\n',
    'utf8',
  );
  return headers;
}

if (process.argv[1] && process.argv[1].endsWith('extract-headers.ts')) {
  extractHeaders().then((h) => {
    console.log(`Extracted ${h.length} Tracking headers -> ${path.relative(process.cwd(), HEADERS_OUT)}`);
    h.forEach((x, i) => console.log(`  ${String(i + 1).padStart(2)}. ${JSON.stringify(x)}`));
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
