// An entry's earlier versions, as GET /api/entries/:id/history lists them.
import { ApiProperty } from '@nestjs/swagger';
import type { EntryRevision } from '@/database/entities';
import { MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';

export class EntryRevisionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ description: 'The entry this version belongs to' })
  entryId: number;

  @ApiProperty({ type: String, nullable: true })
  title: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Time of day (HH:MM), or null' })
  timeOfDay: string | null;

  @ApiProperty({ type: Number, nullable: true, minimum: MIN_MOOD, maximum: MAX_MOOD })
  mood: number | null;

  @ApiProperty({ type: [String] })
  feelings: string[];

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD) of this version' })
  date: string;

  @ApiProperty({ description: 'Text format of this version, such as plain or markdown' })
  format: string;

  @ApiProperty({ enum: ['public', 'private'] })
  visibility: string;

  @ApiProperty({ description: 'When this version was replaced' })
  createdAt: Date;
}

/** A stored revision as the API answers it, without its owner. */
export function toEntryRevisionResponse(revision: EntryRevision): EntryRevisionResponseDto {
  return {
    id: revision.id,
    entryId: revision.entryId,
    title: revision.title ?? null,
    timeOfDay: revision.timeOfDay ?? null,
    mood: revision.mood ?? null,
    feelings: revision.feelings ?? [],
    content: revision.content,
    tags: revision.tags ?? [],
    date: revision.date,
    format: revision.format,
    visibility: revision.visibility,
    createdAt: revision.createdAt,
  };
}
