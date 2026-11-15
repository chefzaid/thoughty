import { ConflictException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import type { User } from '@/database/entities';

/** New usernames are cut to this length (the column keeps up to 100, as older accounts may). */
export const USERNAME_MAX_LENGTH = 50;
/** Tries at finding a free username before giving up. */
const USERNAME_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

/**
 * `base` (cut to 50 characters), or, when another account has it, `base` with a random six-digit
 * number. Only a hint: a racing request can still take the name before it is saved, so the insert
 * that follows must handle a unique violation (`uniqueViolationOf`).
 */
export async function freeUsername(users: Repository<User>, base: string): Promise<string> {
  const name = base.substring(0, USERNAME_MAX_LENGTH);
  for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt === 0 ? name : `${name.substring(0, 43)}-${crypto.randomInt(100000, 1000000)}`;
    if (!(await users.exists({ where: { username: candidate } }))) {
      return candidate;
    }
  }
  throw apiError(ConflictException, 'AUTH_USERNAME_TAKEN');
}

/**
 * The constraint a PostgreSQL unique violation (`23505`) names (an empty string when it names
 * none), or `undefined` for any other error.
 */
export function uniqueViolationOf(error: unknown): string | undefined {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  if (code !== UNIQUE_VIOLATION) return undefined;
  return typeof constraint === 'string' ? constraint : '';
}

/** The conflict a unique violation on `constraint` means: a taken username or a taken address. */
export function takenConflict(constraint: string): ConflictException {
  return apiError(
    ConflictException,
    constraint.includes('username') ? 'AUTH_USERNAME_TAKEN' : 'AUTH_EMAIL_TAKEN',
  );
}
