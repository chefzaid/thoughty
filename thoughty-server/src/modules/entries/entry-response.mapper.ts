import type { Entry } from '@/database/entities';
import type { EntryResponseDto } from './dto';

/**
 * An entry as the entries API sends it: snake_case, with its diary's name, icon and color when the
 * diary was joined, and its attachments when they were. A sealed time capsule shows only its date,
 * diary, flags and when it opens: whatever its row holds, its text is empty and its title, tags, mood,
 * feelings and attachments are left out.
 */
export function toEntryResponse(entry: Entry): EntryResponseDto {
  const sealedUntil = entry.sealedUntil ?? null;
  return sealedUntil ? sealedEntryResponse(openEntryResponse(entry), sealedUntil) : openEntryResponse(entry);
}

function sealedEntryResponse(response: EntryResponseDto, sealedUntil: Date): EntryResponseDto {
  return {
    ...response,
    title: null,
    mood: null,
    feelings: [],
    tags: [],
    content: '',
    sealed_until: sealedUntil,
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
    ...(entry.attachments
      ? {
          attachments: entry.attachments.map((attachment) => ({
            id: attachment.id,
            original_filename: attachment.originalFilename,
            stored_filename: attachment.storedFilename,
            mimetype: attachment.mimetype,
            size: attachment.size,
            transcript: attachment.transcript ?? undefined,
            transcribed_at: attachment.transcribedAt ?? undefined,
          })),
        }
      : {}),
  };
}
