import { ConflictException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import type { Entry } from '@/database/entities';

/** Refuses changing or reading through an entry while it is a sealed time capsule; the writer can open it early first. */
export function assertEntryNotSealed(entry: Pick<Entry, 'sealedUntil'>): void {
  if (entry.sealedUntil) {
    throw apiError(ConflictException, 'ENTRY_SEALED');
  }
}
