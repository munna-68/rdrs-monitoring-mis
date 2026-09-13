import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getDb, schema } from './db';
import { eq } from 'drizzle-orm';
import { isRole, homeFor, type Role } from './roles';

export const SESSION_COOKIE = 'rdrs_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — one working session

export type Session = {
  name: string;
  designation: string;
  branch: string;
  role: Role;
  issuedAt: number;
};

/**
 * PROTOTYPE NOTE: the session is a signed cookie rather than a session table.
 * The payload is tamper-evident via HMAC, so a user cannot simply rewrite the
 * cookie to promote themselves to Superadmin. This is *not* a substitute for a
 * real auth system (no revocation, no rotation) — but it is the right amount of
 * defence for a demo, and it costs ~15 lines.
 *
 * In production SESSION_SECRET must be set. The dev fallback keeps the
 * zero-setup local demo working; it is loud on purpose.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === 'production' && !process.env.RDRS_ALLOW_DEV_SECRET) {
    console.warn(
      '[rdrs] SESSION_SECRET is not set — falling back to a development secret. ' +
      'Set SESSION_SECRET in your Vercel project before sharing this deployment.',
    );
  }
  return 'rdrs-prototype-dev-secret';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodeSession(s: Session): string {
  const body = Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Session;
    if (!parsed || typeof parsed.name !== 'string' || !isRole(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ------------------------------- reads ------------------------------- */

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

/* ------------------------------ writes ------------------------------- */

export async function setSessionCookie(s: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/* ------------------------------- login ------------------------------- */

export type LoginResult =
  | { ok: true; session: Session; redirectTo: string }
  | { ok: false; error: string };

/**
 * The access code is the only credential. It determines the role for the
 * session; name / designation / branch are captured for attribution.
 */
export async function loginWithCode(input: {
  name: string;
  designation: string;
  branch: string;
  code: string;
}): Promise<LoginResult> {
  const name = input.name.trim();
  const designation = input.designation.trim();
  const branch = input.branch.trim();
  const code = input.code.trim();

  if (!name) return { ok: false, error: 'Name is required.' };
  if (!designation) return { ok: false, error: 'Designation is required.' };
  if (!branch) return { ok: false, error: 'Branch is required.' };
  if (!code) return { ok: false, error: 'Access code is required.' };

  const db = await getDb();
  const row = await db.query.accessCodes.findFirst({
    where: eq(schema.accessCodes.code, code),
  });

  if (!row) return { ok: false, error: 'That access code is not recognised.' };

  const session: Session = {
    name,
    designation,
    branch,
    role: row.role,
    issuedAt: Date.now(),
  };
  return { ok: true, session, redirectTo: homeFor(row.role) };
}
