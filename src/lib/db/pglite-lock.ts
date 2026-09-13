import fs from 'node:fs';
import path from 'node:path';

/**
 * Ownership handling for the embedded Postgres (PGlite) data directory.
 *
 * THE PROBLEM
 * PGlite refuses to open a data directory that already contains a
 * `postmaster.pid`. It writes that file itself — always containing the sentinel
 * value `-42`, because Postgres runs in-process under WebAssembly rather than as
 * a real server, so there is no OS process id to record.
 *
 * That makes the file useless as a liveness signal in both directions:
 *   - a killed process leaves it behind and every later run deadlocks, and
 *   - we cannot tell a leftover file from a directory that is genuinely in use
 *     by a running dev server.
 *
 * THE FIX
 * Keep our own lock file, containing a real PID, alongside the data directory.
 * Before opening:
 *   - owner alive   -> fail loudly, because two processes cannot share a PGlite
 *                      directory and silently corrupting the demo database is
 *                      worse than an error message.
 *   - owner dead    -> clear both our lock and the stale `postmaster.pid`, then
 *                      take ownership.
 *   - no lock file  -> no owner is recorded, so any `postmaster.pid` present is
 *                      stale by definition and gets cleared.
 */

type LockRecord = { pid: number; startedAt: string };

function lockPathFor(dataDir: string): string {
  // A sibling of the data directory, not inside it, so Postgres never sees it.
  return path.join(path.dirname(dataDir), `.${path.basename(dataDir)}.owner.lock`);
}

function removeQuietly(file: string): boolean {
  try {
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

function isAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0); // existence/permission probe, delivers no signal
    return true;
  } catch (err) {
    // EPERM => the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readLock(lockPath: string): LockRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as LockRecord;
    return typeof parsed?.pid === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function pgliteDataDir(): string {
  return process.env.PGLITE_DIR
    ? path.resolve(process.env.PGLITE_DIR)
    : path.join(process.cwd(), '.pglite-data');
}

/**
 * Clears stale state and claims ownership of the data directory.
 * Throws if another live process currently owns it.
 */
export function preparePgliteDataDir(dataDir: string): void {
  const lockPath = lockPathFor(dataDir);
  const pgPidFile = path.join(dataDir, 'postmaster.pid');

  const owner = readLock(lockPath);
  if (owner) {
    if (isAlive(owner.pid)) {
      throw new Error(
        `The embedded database at ${dataDir} is already open by process ${owner.pid} ` +
        `(started ${owner.startedAt}). Embedded Postgres cannot be shared between ` +
        `processes — stop that process first, or point DATABASE_URL at a real Postgres ` +
        `server if you need concurrent access.`,
      );
    }
    removeQuietly(lockPath);
    removeQuietly(pgPidFile);
    console.warn(
      `[rdrs] Recovered the embedded database from a process (pid ${owner.pid}) that exited without cleaning up.`,
    );
  } else {
    // No owner on record: any postmaster.pid is a leftover from a killed run.
    if (removeQuietly(pgPidFile)) {
      console.warn('[rdrs] Removed a stale Postgres lock left behind by an earlier run.');
    }
  }

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8');

  // Release on a clean exit. SIGKILL cannot be trapped, which is exactly the
  // case the liveness check above exists to handle.
  const release = () => removeQuietly(lockPath);
  process.once('exit', release);
  process.once('SIGINT', () => { release(); process.exit(130); });
  process.once('SIGTERM', () => { release(); process.exit(143); });
}
