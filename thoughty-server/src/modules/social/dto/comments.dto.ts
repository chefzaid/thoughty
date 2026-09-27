import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { ENTRY_COMMENT_MAX_LENGTH } from '@/database/entities';

export class CreateEntryCommentDto {
  @ApiProperty({ example: 'This one stayed with me all day.', minLength: 1, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, ENTRY_COMMENT_MAX_LENGTH)
  content!: string;
}

export class EntryCommentAuthorDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;
}

export class EntryCommentDto {
  @ApiProperty({ example: 41 })
  id!: number;

  @ApiProperty({ example: 'This one stayed with me all day.' })
  content!: string;

  @ApiProperty({ example: '2026-09-01T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: EntryCommentAuthorDto })
  author!: EntryCommentAuthorDto;

  @ApiProperty({ description: 'The current user wrote the comment or owns the entry' })
  canDelete!: boolean;
}

export class EntryCommentsResponseDto {
  @ApiProperty({ type: [EntryCommentDto], description: 'Most recent comments, oldest first' })
  comments!: EntryCommentDto[];

  @ApiProperty({ example: 3, description: 'All visible comments on the entry' })
  total!: number;
}

export class EntryCommentDeletedDto {
  @ApiProperty({ example: 41 })
  id!: number;

  @ApiProperty({ example: true })
  deleted!: boolean;
}
