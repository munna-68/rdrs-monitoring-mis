import ExcelJS from 'exceljs';
import { TRACKING_COLUMNS, TRACKING_HEADER_COUNT, TRACKING_SOURCE } from './tracking-headers';
import { toTrackingRow, type EntryWithRefs, type TrackingCell } from './entries';

export type ExportOptions = {
  /** Append submitter/branch columns after the 31 Tracking columns. Default false. */
  includeSubmitterColumns?: boolean;
};

/**
 * Rows 1–2 of the source Tracking sheet hold a stray "Date: <value>" annotation
 * in column I, above the real header row. Any downstream parser that reads this
 * workbook has been written against headers-on-row-3, so we reproduce that
 * offset rather than "cleaning it up" and breaking the handoff.
 */
const HEADER_ROW = TRACKING_SOURCE.row;
const META_COLUMN = 9; // column I in the source

const EXTRA_COLUMNS = [
  { header: 'Branch', key: 'branch', width: 18 },
  { header: 'Submitted By', key: 'submittedByName', width: 22 },
  { header: 'Designation', key: 'submittedByDesignation', width: 22 },
  { header: 'Submitted At', key: 'createdAt', width: 20 },
  { header: 'Last Edited By', key: 'lastEditedByName', width: 22 },
  { header: 'Last Edited At', key: 'lastEditedAt', width: 20 },
] as const;

/**
 * Builds the workbook that replaces the manual consolidation step.
 *
 * The header row is written straight from `TRACKING_COLUMNS`, which was
 * extracted from the source workbook — so it reproduces the exact column set,
 * order, spelling ("Varience"), trailing spaces and number formats. Values are
 * projected positionally by `toTrackingRow`, which indexes off the same map.
 */
export async function buildTrackingWorkbook(
  entries: EntryWithRefs[],
  opts: ExportOptions = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RDRS Monitoring MIS';
  wb.created = new Date();

  const ws = wb.addWorksheet(TRACKING_SOURCE.sheet);

  // --- metadata rows, mirroring the source layout -------------------------
  ws.getCell(1, META_COLUMN).value = 'Date';
  ws.getCell(2, META_COLUMN).value = new Date();
  ws.getCell(2, META_COLUMN).numFmt = 'dd/mm/yyyy';

  // --- header row ---------------------------------------------------------
  const headerRow = ws.getRow(HEADER_ROW);
  TRACKING_COLUMNS.forEach((spec, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = spec.header;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', wrapText: false };
  });

  // Column-level number formats and widths, taken from the source sheet.
  TRACKING_COLUMNS.forEach((spec, i) => {
    const col = ws.getColumn(i + 1);
    if (spec.numFmt && spec.numFmt !== 'General') col.numFmt = spec.numFmt;
    if (spec.width) col.width = spec.width;
  });

  const extraOffset = TRACKING_HEADER_COUNT;
  if (opts.includeSubmitterColumns) {
    EXTRA_COLUMNS.forEach((spec, i) => {
      const cell = headerRow.getCell(extraOffset + i + 1);
      cell.value = spec.header;
      cell.font = { bold: true };
      ws.getColumn(extraOffset + i + 1).width = spec.width;
    });
  }

  // --- data rows ----------------------------------------------------------
  for (const entry of entries) {
    const values = toTrackingRow(entry);
    if (values.length !== TRACKING_HEADER_COUNT) {
      throw new Error(
        `Export aborted: row has ${values.length} cells but the Tracking sheet has ${TRACKING_HEADER_COUNT} columns.`,
      );
    }
    const row = ws.addRow([] as TrackingCell[]);
    values.forEach((v, i) => {
      if (v === null || v === undefined || v === '') return; // leave blank, don't write zeros
      row.getCell(i + 1).value = v;
    });

    if (opts.includeSubmitterColumns) {
      const extras: (string | Date | null)[] = [
        entry.branch,
        entry.submittedByName,
        entry.submittedByDesignation,
        entry.createdAt ?? null,
        entry.lastEditedByName ?? null,
        entry.lastEditedAt ?? null,
      ];
      extras.forEach((v, i) => {
        if (v === null || v === undefined || v === '') return;
        row.getCell(extraOffset + i + 1).value = v;
      });
    }
  }

  // Freeze below the header so the columns stay visible while scrolling.
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Filename that makes it obvious which slice of data this export covers. */
export function exportFilename(parts: {
  projectName?: string | null;
  branch?: string | null;
  from?: string | null;
  to?: string | null;
}): string {
  const bits = ['RDRS_MIS_Tracking'];
  if (parts.projectName) bits.push(slug(parts.projectName));
  if (parts.branch) bits.push(slug(parts.branch));
  if (parts.from || parts.to) bits.push(`${parts.from ?? 'start'}_to_${parts.to ?? 'now'}`);
  bits.push(new Date().toISOString().slice(0, 10));
  return `${bits.join('_')}.xlsx`;
}

function slug(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
