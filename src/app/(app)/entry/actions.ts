'use server';

import { revalidatePath } from 'next/cache';
import { getDb, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/roles';
import { computeTotal, toAmount, toCount, emptyCounts, type BeneficiaryCounts } from '@/lib/entries';
import { BENEFICIARY_COLUMNS } from '@/lib/tracking-headers';
// The state type and its initial value live in a plain module: a "use server"
// file may only export async functions.
import type { EntryFormState } from '@/lib/action-state';

export async function createEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session expired. Please sign in again.', message: null };

  // The brief gives submission rights to the User role only. Admin and
  // Superadmin correct existing rows instead of creating new ones.
  if (!can.submit(session.role)) {
    return {
      ok: false,
      error: 'Your role can view and correct entries, but not submit new ones.',
      message: null,
    };
  }

  const projectId = Number(formData.get('projectId'));
  const activityId = Number(formData.get('activityId'));
  const entryDate = String(formData.get('entryDate') ?? '').trim();
  const actualExpenditure = toAmount(formData.get('actualExpenditure'));

  if (!Number.isFinite(projectId) || projectId <= 0) {
    return { ok: false, error: 'Choose a project.', message: null };
  }
  if (!Number.isFinite(activityId) || activityId <= 0) {
    return { ok: false, error: 'Choose an activity.', message: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { ok: false, error: 'Enter a valid date.', message: null };
  }

  const counts = emptyCounts();
  for (const col of BENEFICIARY_COLUMNS) {
    counts[col.key] = toCount(formData.get(col.key));
  }
  const total = computeTotal(counts);

  if (total === 0 && actualExpenditure === 0) {
    return {
      ok: false,
      error: 'Enter at least an expenditure amount or one beneficiary count — the row would otherwise be empty.',
      message: null,
    };
  }

  const db = await getDb();

  // Guard against a mismatched project/activity pair (e.g. a stale form).
  const activity = await db.query.activities.findFirst({
    where: eq(schema.activities.id, activityId),
  });
  if (!activity || activity.projectId !== projectId) {
    return { ok: false, error: 'That activity does not belong to the selected project.', message: null };
  }

  // Month and year are derived here, never taken from the form, so they can
  // never disagree with the date.
  const [y, m] = entryDate.split('-').map(Number);

  await db.insert(schema.entries).values({
    entryDate,
    month: m,
    year: y,
    projectId,
    activityId,
    actualExpenditure,
    ...(counts as BeneficiaryCounts),
    total,
    submittedByName: session.name,
    submittedByDesignation: session.designation,
    branch: session.branch,
    submittedByRole: session.role,
  });

  revalidatePath('/entry');
  revalidatePath('/records');

  return {
    ok: true,
    error: null,
    message: `Entry saved for ${activity.name.slice(0, 60)}${activity.name.length > 60 ? '…' : ''} — total ${total}.`,
  };
}
