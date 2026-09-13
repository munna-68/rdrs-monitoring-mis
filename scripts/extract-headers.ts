/**
 * Extracts the "Tracking" sheet's header row — plus each column's number format
 * and width — from the source workbook, and writes them to
 * src/lib/generated/tracking-headers.json.
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
 * "Project Name " and "Annual Target ". Number formats and column widths come
 * along too, so the export also *looks* like the sheet it replaces.
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

export type ColumnSpec = {
  header: string;
  numFmt: string;
  width: number | null;
};

/** Locate the Tracking header row by content, not by a hard-coded row number. */
export function findHeaderRow(ws: ExcelJS.Worksheet): { rowNumber: number; columns: ColumnSpec[] } {
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const row = ws.getRow(r);
    const texts: string[] = [];
    const fmts: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      texts[col - 1] = cellToText(cell.value);
      fmts[col - 1] = cell.numFmt ?? 'General';
    });

    const hasDate = texts[0] === 'Date';
    const hasTotal = texts.includes('Total');
    if (!hasDate || !hasTotal) continue;

    // Trim trailing blanks that are formatting artefacts, not real columns.
    let last = texts.length - 1;
    while (last >= 0 && (texts[last] ?? '') === '') last--;

    const columns: ColumnSpec[] = [];
    for (let i = 0; i <= last; i++) {
      const width = ws.getColumn(i + 1).width;
      columns.push({
        header: texts[i] ?? '',
        numFmt: fmts[i] ?? 'General',
        width: typeof width === 'number' ? width : null,
      });
    }
    return { rowNumber: r, columns };
  }
  throw new Error('Could not locate a Tracking header row (expected "Date" in col A and "Total").');
}

export function cellToText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
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

export async function extractHeaders(): Promise<ColumnSpec[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);
  const ws = wb.getWorksheet('Tracking');
  if (!ws) throw new Error('Workbook has no "Tracking" sheet.');
  const { rowNumber, columns } = findHeaderRow(ws);
  fs.mkdirSync(path.dirname(HEADERS_OUT), { recursive: true });
  fs.writeFileSync(
    HEADERS_OUT,
    JSON.stringify(
      { sourceSheet: 'Tracking', sourceRow: rowNumber, columns },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  return columns;
}

if (process.argv[1] && process.argv[1].endsWith('extract-headers.ts')) {
  extractHeaders()
    .then((cols) => {
      console.log(`Extracted ${cols.length} Tracking columns -> ${path.relative(process.cwd(), HEADERS_OUT)}`);
      cols.forEach((c, i) =>
        console.log(
          `  ${String(i + 1).padStart(2)}. ${JSON.stringify(c.header).padEnd(40)} fmt=${JSON.stringify(c.numFmt).padEnd(12)} w=${c.width ?? '-'}`,
        ),
      );
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
