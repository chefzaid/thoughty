import type { EntityManager } from 'typeorm';
import type { BookVersionManifest } from '@/database/entities';
import { lockedEntrySql } from '@/common/content-lock';

/**
 * Whether a saved book version holds the text of any of its writer's entries that are locked now. A
 * version keeps the file it was built as, so one built while unlocked would otherwise carry locked text
 * out: its download needs an unlocked request, and its share link does not open, while this holds.
 */
export async function bookVersionHoldsLockedEntries(
  manager: EntityManager,
  userId: number,
  manifest: BookVersionManifest | null | undefined,
): Promise<boolean> {
  // A version saved before manifests listed their entries holds none this can tell
  const entryIds = manifest?.chapters?.flatMap((chapter) => chapter.entryIds ?? []) ?? [];
  if (entryIds.length === 0) return false;
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM entries e WHERE e.user_id = $1 AND e.id = ANY($2::int[]) AND ${lockedEntrySql('e')} LIMIT 1`,
    [userId, entryIds],
  );
  return rows.length > 0;
}
