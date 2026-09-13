'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/roles';
import { computeTotal, toAmount, toCount, emptyCounts } from '@/lib/entries';
import { BENEFICIARY_COLUMNS } from '@/lib/tracking-headers';

export type EditFormState = { ok: boolean; error: string | null; message: string | null };
export const initialEditState: EditFormState = { ok: false, error: null, message: null };

/**
 * The "re-entry" path from the meeting notes: an Admin corrects an entry that
 * has already been submitted. We record who made the correction and when, which
 * is the extent of the audit trail in scope for this pass.
 */
export async function updateEntryAction(
  _prev: EditFormState,
  formData: FormData,
): Promise<EditFormState> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session expired. Please sign in again.', message: null };
  if (!can.editEntry(session.role)) {
    return { ok: false, error: 'Only Admin and Superadmin roles can correct entries.', message: null };
  }

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Missing entry id.', message: null };
  }

  const entryDate = String(formData.get('entryDate') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return { ok: false, error: 'Enter a valid date.', message: null };
  }

  const actualExpenditure = toAmount(formData.get('actualExpenditure'));
  const counts = emptyCounts();
  for (const col of BENEFICIARY_COLUMNS) {
    counts[col.key] = toCount(formData.get(col.key));
  }
  const total = computeTotal(counts);
  const [y, m] = entryDate.split('-').map(Number);

  const db = await getDb();
  const existing = await db.query.entries.findFirst({ where: eq(schema.entries.id, id) });
  if (!existing) return { ok: false, error: 'That entry no longer exists.', message: null };

  await db
    .update(schema.entries)
    .set({
      entryDate,
      month: m,
      year: y,
      actualExpenditure,
      ...counts,
      total,
      lastEditedByName: session.name,
      lastEditedByDesignation: session.designation,
      lastEditedAt: new Date(),
    })
    .where(eq(schema.entries.id, id));

  revalidatePath('/records');
  revalidatePath(`/records/${id}/edit`);
  revalidatePath('/dashboard');

  redirect(`/records?corrected=${id}`);
}
