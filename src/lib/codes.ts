import crypto from 'node:crypto';
import type { Role } from './roles';

/**
 * Access codes are read aloud and typed by hand, so the alphabet excludes
 * characters that get confused when spoken or transcribed: O/0, I/1, S/5.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

function block(n: number): string {
  return Array.from(crypto.randomBytes(n))
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('');
}

export function generateCode(role: Role): string {
  return `${role}-${block(4)}-${block(4)}`;
}
