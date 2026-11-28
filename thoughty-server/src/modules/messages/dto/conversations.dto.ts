import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { MESSAGE_MAX_LENGTH } from '@/database/entities';

export class SendMessageDto {
  @ApiProperty({
    example: 'Your walk by the river made me want to go back there.',
    minLength: 1,
    maxLength: MESSAGE_MAX_LENGTH,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, MESSAGE_MAX_LENGTH)
  body!: string;

  @ApiPropertyOptional({
    description:
      'One of your public entries to share with the message, which the other writer can already read in the feed',
    minimum: 1,
    example: 42,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  entryId?: number;
}

export class ConversationMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Only the messages sent before this one (its id), to read further back',
    minimum: 1,
    example: 120,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  before?: number;
}

export class ConversationWriterDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;
}

/** The public entry a message shares, by its day, its number that day and its title. */
export class MessageEntryDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: '2026-11-20' })
  date!: string;

  @ApiProperty({ example: 1 })
  index!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title!: string | null;
}

export class MessageDto {
  @ApiProperty({ example: 120 })
  id!: number;

  @ApiProperty({ example: 7 })
  conversationId!: number;

  @ApiProperty({ example: 2, description: 'Who wrote it' })
  senderId!: number;

  @ApiProperty({ description: 'The current user wrote it' })
  mine!: boolean;

  @ApiProperty({ example: 'Your walk by the river made me want to go back there.' })
  body!: string;

  @ApiProperty({ example: '2026-11-28T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({
    type: MessageEntryDto,
    nullable: true,
    description:
      'The public entry the message shares, while the current user may read it in the feed; null otherwise',
  })
  entry!: MessageEntryDto | null;

  @ApiProperty({
    description:
      'The message shared an entry the current user can no longer read (made private, archived, hidden by moderation or in the recycle bin)',
  })
  entryUnavailable!: boolean;
}

export class ConversationSummaryDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ type: ConversationWriterDto, description: 'The other writer in the conversation' })
  writer!: ConversationWriterDto;

  @ApiProperty({
    type: MessageDto,
    nullable: true,
    description: 'The newest message, null before the first one',
  })
  lastMessage!: MessageDto | null;

  @ApiProperty({
    example: 2,
    description: 'Messages from the other writer the current user has not read',
  })
  unreadCount!: number;

  @ApiProperty({
    description:
      'Whether the current user may write in it: they follow each other and neither blocked the other. Otherwise it can only be read',
  })
  canWrite!: boolean;
}

export class ConversationListDto {
  @ApiProperty({
    type: [ConversationSummaryDto],
    description: 'Conversations with at least one message, the most recent first',
  })
  conversations!: ConversationSummaryDto[];
}

export class ConversationThreadDto {
  @ApiProperty({ type: ConversationSummaryDto })
  conversation!: ConversationSummaryDto;

  @ApiProperty({
    type: [MessageDto],
    description: 'The newest messages (or those before `before`), oldest first',
  })
  messages!: MessageDto[];

  @ApiProperty({
    description: 'Older messages remain: ask again with `before` set to the first one here',
  })
  hasMore!: boolean;
}

export class UnreadMessagesDto {
  @ApiProperty({ example: 3, description: 'Unread messages across every conversation' })
  unreadCount!: number;
}
