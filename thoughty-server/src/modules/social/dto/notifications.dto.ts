import { ApiProperty } from '@nestjs/swagger';

/**
 * What happened: a comment on your entry, a like on your entry or comment, a new follower, a request to follow
 * you waiting for your approval (Followers by approval), or messages you have not read in a conversation.
 */
export const notificationTypes = [
  'comment',
  'entryLike',
  'commentLike',
  'follow',
  'followRequest',
  'message',
] as const;
export type NotificationType = (typeof notificationTypes)[number];

/** Who commented, liked, followed, asked to follow or wrote to you. */
export class NotificationActorDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;
}

/** The public entry it is about: yours for a comment or a like, the one you commented on for a liked comment. */
export class NotificationEntryDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: '2026-11-20' })
  date!: string;

  @ApiProperty({ example: 1 })
  index!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title!: string | null;
}

/** The comment written or liked, by its first words. */
export class NotificationCommentDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({
    example: 'What a lovely morning to read about.',
    description: 'The comment\'s first 140 characters',
  })
  excerpt!: string;
}

/** The conversation with unread messages, how many, and the newest one by its first words. */
export class NotificationConversationDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 3, description: 'Messages in it you have not read' })
  messageCount!: number;

  @ApiProperty({
    example: 'Your walk by the river made me want to go back there.',
    description: "The newest unread message's first 140 characters",
  })
  excerpt!: string;
}

export class NotificationDto {
  @ApiProperty({
    example: 'comment:7',
    description: 'Stable key of the notification, made of its type and what it is about',
  })
  id!: string;

  @ApiProperty({ enum: notificationTypes, example: 'comment' })
  type!: NotificationType;

  @ApiProperty({ example: '2026-11-21T08:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: true, description: 'Whether it came after the notifications were last opened' })
  unread!: boolean;

  @ApiProperty({ type: NotificationActorDto })
  actor!: NotificationActorDto;

  @ApiProperty({
    type: NotificationEntryDto,
    nullable: true,
    description: 'Null for a new follower, a follow request or messages',
  })
  entry!: NotificationEntryDto | null;

  @ApiProperty({
    type: NotificationCommentDto,
    nullable: true,
    description: 'The comment written (`comment`) or liked (`commentLike`); null otherwise',
  })
  comment!: NotificationCommentDto | null;

  @ApiProperty({
    type: NotificationConversationDto,
    nullable: true,
    description:
      'The conversation with unread messages (`message`), one notification per conversation until it is read; null otherwise',
  })
  conversation!: NotificationConversationDto | null;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto], description: 'The 30 most recent notifications, newest first' })
  notifications!: NotificationDto[];

  @ApiProperty({ example: 3, description: 'Notifications that came after they were last opened' })
  unreadCount!: number;
}

export class UnreadNotificationsDto {
  @ApiProperty({ example: 3, description: 'Notifications that came after they were last opened' })
  unreadCount!: number;
}
