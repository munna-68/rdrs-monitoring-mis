export const ROLES = ['USER', 'VIEW', 'ADMIN', 'SUPERADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  USER: 'User (Monitoring Officer)',
  VIEW: 'View (Read-only)',
  ADMIN: 'Admin',
  SUPERADMIN: 'Superadmin',
};

export const ROLE_SHORT: Record<Role, string> = {
  USER: 'User',
  VIEW: 'View',
  ADMIN: 'Admin',
  SUPERADMIN: 'Superadmin',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  USER: 'Submit activity entries for your own branch and download your own submissions.',
  VIEW: 'Read-only access to every entry across branches and projects. Can download.',
  ADMIN: 'Everything View can do, plus correct any existing entry (re-entry).',
  SUPERADMIN: 'Everything Admin can do, plus access-code management and the project/activity master list.',
};

/** Privilege ladder — used for "at least this role" checks. */
const RANK: Record<Role, number> = { USER: 0, VIEW: 1, ADMIN: 2, SUPERADMIN: 3 };

export function atLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/** The permission matrix, in one place so no route has to re-derive it. */
export const can = {
  /** Submit a new entry. */
  submit: (r: Role) => r === 'USER',
  /** See every branch's entries (vs. only your own). */
  viewAllEntries: (r: Role) => atLeast(r, 'VIEW'),
  /** Download the consolidated Excel export. */
  exportExcel: (r: Role) => atLeast(r, 'VIEW'),
  /** Correct an existing entry (the "re-entry" requirement). */
  editEntry: (r: Role) => atLeast(r, 'ADMIN'),
  /** View / regenerate the shared access codes. */
  manageCodes: (r: Role) => r === 'SUPERADMIN',
  /** Add or edit projects and the activity master list. */
  manageMaster: (r: Role) => r === 'SUPERADMIN',
};

/** Which landing page each role gets after login. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'USER': return '/entry';
    case 'VIEW': return '/records';
    case 'ADMIN':
    case 'SUPERADMIN': return '/dashboard';
  }
}
