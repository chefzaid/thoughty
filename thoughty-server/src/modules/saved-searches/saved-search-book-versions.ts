import type { EntityManager } from 'typeorm';

/**
 * The version history of the books built from one saved search. It lives here, not in the books
 * module, because deleting a saved search deletes that history and the books module already
 * depends on this one.
 */
export function savedSearchBookScopeKey(savedSearchId: number): string {
  return `search:${savedSearchId}`;
}

/**
 * Serializes the writes to one book version history (`scope_key`) of one writer until the
 * transaction ends: numbering a new version, or deleting the history with its saved search.
 */
export async function lockBookVersionHistory(manager: EntityManager, userId: number, scopeKey: string): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [userId, scopeKey]);
}
