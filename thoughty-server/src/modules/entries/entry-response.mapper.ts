import type { Entry } from '@/database/entities';
import { isEntryWithheld } from '@/common/content-lock';
import { entryLocationOf } from '@/common/utils/entry-location.util';
import type { EntryResponseDto } from './dto';

/**
 * An entry as the entries API sends it: snake_case, with its diary's name, icon and color when the
 * diary was joined, and its attachments when they were. A sealed time capsule shows only its date,
 * diary, flags and when it opens: whatever its row holds, its text is empty and its title, tags, mood,
 * feelings, place and attachments are left out. A locked entry, unless the request is unlocked, keeps only its
 * title (as the privacy blur does) beside its date, diary and flags, and says it was `withheld`.
 */
export function toEntryResponse(entry: Entry): EntryResponseDto {
  const sealedUntil = entry.sealedUntil ?? null;
  const response = sealedUntil ? sealedEntryResponse(openEntryResponse(entry), sealedUntil) : openEntryResponse(entry);
  return isEntryWithheld(entry) ? withheldEntryResponse(response) : response;
}

function withheldEntryResponse(response: EntryResponseDto): EntryResponseDto {
  return {
    ...response,
    mood: null,
    feelings: [],
    location: null,
    tags: [],
    content: '',
    withheld: true,
    ...(response.attachments ? { attachments: [] } : {}),
  };
}

function sealedEntryResponse(response: EntryResponseDto, sealedUntil: Date): EntryResponseDto {
  return {
    ...response,
    title: null,
    mood: null,
    feelings: [],
    location: null,
    tags: [],
    content: '',
    sealed_until: sealedUntil,
    reread_on: null,
    ...(response.attachments ? { attachments: [] } : {}),
  };
}

function openEntryResponse(entry: Entry): EntryResponseDto {
  return {
    id: entry.id,
    user_id: entry.userId,
    diary_id: entry.diaryId,
    date: entry.date,
    index: entry.index,
    title: entry.title ?? null,
    time_of_day: entry.timeOfDay ?? null,
    mood: entry.mood ?? null,
    feelings: entry.feelings ?? [],
    location: entryLocationOf(entry),
    tags: entry.tags,
    content: entry.content,
    format: entry.format,
    visibility: entry.visibility,
    is_favorite: entry.isFavorite,
    is_archived: entry.isArchived,
    is_pinned: entry.isPinned,
    diary_name: entry.diary?.name,
    diary_icon: entry.diary?.icon,
    diary_color: entry.diary?.color ?? undefined,
    created_at: entry.createdAt,
    sealed_until: null,
    reread_on: entry.rereadOn ?? null,
    is_locked: Boolean(entry.isLocked),
    diary_locked: Boolean(entry.diaryLocked),
    withheld: false,
    ...(entry.attachments
      ? {
          attachments: entry.attachments.map((attachment) => ({
            id: attachment.id,
            original_filename: attachment.originalFilename,
            stored_filename: attachment.storedFilename,
            mimetype: attachment.mimetype,
            size: attachment.size,
            poster_filename: attachment.posterFilename ?? undefined,
            transcript: attachment.transcript ?? undefined,
            transcribed_at: attachment.transcribedAt ?? undefined,
          })),
        }
      : {}),
  };
}
