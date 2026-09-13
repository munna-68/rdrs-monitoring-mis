import generated from './generated/tracking-headers.json';

/**
 * The export contract.
 *
 * `generated/tracking-headers.json` is produced by `scripts/extract-headers.ts`
 * directly from the Tracking sheet in data/MIS_Data_Sheet.xlsx — it is not
 * hand-written. Regenerate it with `npm run extract:headers`.
 *
 * Consequence: `TRACKING_HEADERS` reproduces the source header row exactly,
 * including "Varience" (sic), and the trailing spaces in "Project Name " and
 * "Annual Target ". Do not "fix" those — the export is meant to drop straight
 * into the existing consolidation workflow, and a renamed column would break
 * the downstream formulas that read this sheet.
 */
export const TRACKING_HEADERS: readonly string[] = generated.headers;
export const TRACKING_HEADER_COUNT = TRACKING_HEADERS.length;
export const TRACKING_SOURCE = {
  sheet: generated.sourceSheet,
  row: generated.sourceRow,
  file: 'data/MIS_Data_Sheet.xlsx',
} as const;

/**
 * Column positions, resolved by name so the mapping survives a re-extract.
 *
 * Lookup is by *exact* header text (trailing spaces included). If a future
 * revision of the workbook renames or reorders a column, `columnIndex` throws
 * at module load instead of silently writing values into the wrong column.
 */
function columnIndex(exactHeader: string): number {
  const i = TRACKING_HEADERS.indexOf(exactHeader);
  if (i === -1) {
    throw new Error(
      `Tracking header ${JSON.stringify(exactHeader)} not found. ` +
      `The source workbook's Tracking sheet changed — re-run ` +
      `\`npm run extract:headers\` and update the column map if the column was renamed.`,
    );
  }
  return i;
}

export const COL = {
  date: columnIndex('Date'),
  month: columnIndex('Month'),
  year: columnIndex('Year'),
  project: columnIndex('Project'),
  activityCode: columnIndex('Activity Code'),
  serial: columnIndex('sl'),
  projectName: columnIndex('Project Name '),           // trailing space is in the source
  activityName: columnIndex('Project Activities'),
  unitType: columnIndex('Unit Type'),
  intervention: columnIndex('Intervention'),
  activityType: columnIndex('Activity Type'),
  unitRate: columnIndex('Unit Rate (BDT)'),
  projectTarget: columnIndex('Project Target'),
  projectBudget: columnIndex('Project Budget (BDT)'),
  annualTarget: columnIndex('Annual Target '),          // trailing space is in the source
  annualBudget: columnIndex('Annual Budget (BDT) (July 2023-June 2024)'),
  lastQuarterTarget: columnIndex('Last Quarter Target'),
  lastQuarterAchievement: columnIndex('Last Quarter Achievement'),
  variance: columnIndex('Varience'),                    // sic — misspelling preserved
  budget: columnIndex('Budget'),
  actualExpenditure: columnIndex('Actual Expenditure'),
  female26: columnIndex('Female (above 26 years)'),
  male26: columnIndex('Male (above 26 years)'),
  pwd26: columnIndex('PWDs (above 26 years)'),
  youthFemale: columnIndex('Youth Female (15 - 25 years)'),
  youthMale: columnIndex('Youth Male (15 - 25 years)'),
  youthPwd: columnIndex('Youth PWDs (15 - 25 years)'),
  girl: columnIndex('Girl (0 - 14 years)'),
  boy: columnIndex('Boy (0 - 14 years)'),
  pwd14: columnIndex('PWDs (0 - 14 years)'),
  total: columnIndex('Total'),
} as const;

/** The nine beneficiary columns, in sheet order. Drives the form and the export. */
export const BENEFICIARY_COLUMNS = [
  { key: 'female26', header: 'Female (above 26 years)', label: 'Female (26+)' },
  { key: 'male26', header: 'Male (above 26 years)', label: 'Male (26+)' },
  { key: 'pwd26', header: 'PWDs (above 26 years)', label: 'PWDs (26+)' },
  { key: 'youthFemale', header: 'Youth Female (15 - 25 years)', label: 'Youth Female (15–25)' },
  { key: 'youthMale', header: 'Youth Male (15 - 25 years)', label: 'Youth Male (15–25)' },
  { key: 'youthPwd', header: 'Youth PWDs (15 - 25 years)', label: 'Youth PWDs (15–25)' },
  { key: 'girl', header: 'Girl (0 - 14 years)', label: 'Girl (0–14)' },
  { key: 'boy', header: 'Boy (0 - 14 years)', label: 'Boy (0–14)' },
  { key: 'pwd14', header: 'PWDs (0 - 14 years)', label: 'PWDs (0–14)' },
] as const;

export type BeneficiaryKey = (typeof BENEFICIARY_COLUMNS)[number]['key'];
