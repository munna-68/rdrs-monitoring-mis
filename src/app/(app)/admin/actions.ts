'use server';

import { revalidatePath } from 'next/cache';
import { getDb, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { can, isRole } from '@/lib/roles';
import { generateCode } from '@/lib/codes';

export type AdminState = { ok: boolean; error: string | null; message: string | null };
export const initialAdminState: AdminState = { ok: false, error: null, message: null };

async function requireSuperadmin(): Promise<AdminState | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session expired. Please sign in again.', message: null };
  if (!can.manageCodes(session.role) && !can.manageMaster(session.role)) {
    return { ok: false, error: 'Only the Superadmin role can change this.', message: null };
  }
  return null;
}

/* ---------------------------- access codes ---------------------------- */

export async function regenerateCodeAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const role = String(formData.get('role') ?? '');
  if (!isRole(role)) return { ok: false, error: 'Unknown role.', message: null };

  const db = await getDb();
  const code = generateCode(role);
  await db
    .update(schema.accessCodes)
    .set({ code, updatedAt: new Date() })
    .where(eq(schema.accessCodes.role, role));

  revalidatePath('/admin');
  revalidatePath('/login');

  // Changing a code does not invalidate anyone's current session — the cookie is
  // already signed — but anyone holding the old code can no longer sign in.
  return {
    ok: true,
    error: null,
    message: `New ${role} code issued: ${code}. The previous code no longer works.`,
  };
}

export async function regenerateAllCodesAction(
  _prev: AdminState,
  _formData: FormData,
): Promise<AdminState> {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const db = await getDb();
  const rows = await db.select().from(schema.accessCodes);
  const issued: string[] = [];
  for (const row of rows) {
    const code = generateCode(row.role);
    await db
      .update(schema.accessCodes)
      .set({ code, updatedAt: new Date() })
      .where(eq(schema.accessCodes.role, row.role));
    issued.push(`${row.role}: ${code}`);
  }

  revalidatePath('/admin');
  revalidatePath('/login');
  return { ok: true, error: null, message: `All codes reissued — ${issued.join(' · ')}` };
}

/* ------------------------------ projects ------------------------------ */

export async function createProjectAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!name) return { ok: false, error: 'Project name is required.', message: null };
  if (!code) return { ok: false, error: 'Project code is required.', message: null };

  const db = await getDb();
  const existing = await db.query.projects.findFirst({ where: eq(schema.projects.name, name) });
  if (existing) return { ok: false, error: `A project named “${name}” already exists.`, message: null };

  await db.insert(schema.projects).values({ name, code });
  revalidatePath('/admin');
  revalidatePath('/entry');
  return { ok: true, error: null, message: `Project ${name} added.` };
}

/* ----------------------------- activities ----------------------------- */

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function readActivityForm(formData: FormData) {
  return {
    projectId: Number(formData.get('projectId')),
    serialNumber: Number(formData.get('serialNumber')),
    activityCode: String(formData.get('activityCode') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    unitType: String(formData.get('unitType') ?? '').trim() || null,
    intervention: String(formData.get('intervention') ?? '').trim() || null,
    activityType: String(formData.get('activityType') ?? '').trim() || null,
    unitRate: numOrNull(formData.get('unitRate')),
    projectTarget: numOrNull(formData.get('projectTarget')),
    projectBudget: numOrNull(formData.get('projectBudget')),
    annualTarget: numOrNull(formData.get('annualTarget')),
    annualBudget: numOrNull(formData.get('annualBudget')),
  };
}

export async function createActivityAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const v = readActivityForm(formData);
  if (!Number.isFinite(v.projectId) || v.projectId <= 0) {
    return { ok: false, error: 'Choose a project.', message: null };
  }
  if (!Number.isFinite(v.serialNumber) || v.serialNumber <= 0) {
    return { ok: false, error: 'Serial number must be a positive integer.', message: null };
  }
  if (!v.name) return { ok: false, error: 'Activity name is required.', message: null };
  if (!v.activityCode) return { ok: false, error: 'Activity code is required.', message: null };

  const db = await getDb();
  const clash = await db.query.activities.findFirst({
    where: (a, { and, eq: e }) => and(e(a.projectId, v.projectId), e(a.serialNumber, v.serialNumber)),
  });
  if (clash) {
    return {
      ok: false,
      error: `Serial ${v.serialNumber} is already used in that project (${clash.name.slice(0, 50)}).`,
      message: null,
    };
  }

  await db.insert(schema.activities).values(v);
  revalidatePath('/admin');
  revalidatePath('/entry');
  return { ok: true, error: null, message: `Activity “${v.name.slice(0, 50)}” added.` };
}

export async function updateActivityAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing activity id.', message: null };

  const v = readActivityForm(formData);
  if (!v.name) return { ok: false, error: 'Activity name is required.', message: null };
  if (!v.activityCode) return { ok: false, error: 'Activity code is required.', message: null };

  const db = await getDb();
  const current = await db.query.activities.findFirst({ where: eq(schema.activities.id, id) });
  if (!current) return { ok: false, error: 'That activity no longer exists.', message: null };

  // Serial + project identify the row; changing the serial could collide.
  const clash = await db.query.activities.findFirst({
    where: (a, { and, eq: e }) =>
      and(e(a.projectId, v.projectId), e(a.serialNumber, v.serialNumber), e(a.id, id)),
  });
  if (clash) {
    return { ok: false, error: `Serial ${v.serialNumber} is already used in that project.`, message: null };
  }

  await db
    .update(schema.activities)
    .set({
      projectId: v.projectId,
      serialNumber: v.serialNumber,
      activityCode: v.activityCode,
      name: v.name,
      unitType: v.unitType,
      intervention: v.intervention,
      activityType: v.activityType,
      unitRate: v.unitRate,
      projectTarget: v.projectTarget,
      projectBudget: v.projectBudget,
      annualTarget: v.annualTarget,
      annualBudget: v.annualBudget,
      updatedAt: new Date(),
    })
    .where(eq(schema.activities.id, id));

  revalidatePath('/admin');
  revalidatePath('/entry');
  revalidatePath('/records');

  // Historical exports join these reference values live, so editing the master
  // list retroactively changes what past entries report. Called out in the UI.
  return {
    ok: true,
    error: null,
    message: `“${v.name.slice(0, 50)}” updated. Past entries now report the new reference values.`,
  };
}
