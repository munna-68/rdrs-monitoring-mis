import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/roles';
import { listEntries, type EntryFilters } from '@/lib/entries';
import { buildTrackingWorkbook, exportFilename } from '@/lib/excel';

export const dynamic = 'force-dynamic';

/**
 * Downloads the consolidated workbook in the Tracking sheet's exact format.
 *
 * Query params mirror the Records screen's filters so "what you see is what you
 * download":
 *   projectId, branch, from, to   — same filters as the table
 *   extras=1                      — append submitter/branch columns (opt-in)
 *
 * Access: USER may export only their own submissions; VIEW and above export
 * everything the filters select.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response('Not signed in.', { status: 401 });
  }

  const isOfficer = session.role === 'USER';
  if (!isOfficer && !can.exportExcel(session.role)) {
    return new Response('Your role cannot export data.', { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const projectIdRaw = sp.get('projectId');
  const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;

  const filters: EntryFilters = {
    projectId: Number.isFinite(projectId) && projectId ? projectId : undefined,
    branch: sp.get('branch')?.trim() || undefined,
    dateFrom: sp.get('from')?.trim() || undefined,
    dateTo: sp.get('to')?.trim() || undefined,
    // Officers are hard-scoped to their own rows regardless of the query string.
    owner: isOfficer ? { name: session.name, branch: session.branch } : undefined,
  };

  const entries = await listEntries(filters);

  const buffer = await buildTrackingWorkbook(entries, {
    includeSubmitterColumns: sp.get('extras') === '1',
  });

  const filename = exportFilename({
    projectName: filters.projectId
      ? (entries[0]?.project?.name ?? String(filters.projectId))
      : null,
    branch: filters.branch ?? null,
    from: filters.dateFrom ?? null,
    to: filters.dateTo ?? null,
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(entries.length),
    },
  });
}
