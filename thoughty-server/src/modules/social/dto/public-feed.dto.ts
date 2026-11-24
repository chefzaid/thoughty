import { IsIn, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StrictInt } from '@/common/validation';

/** `saved` lists the entries the reader saved, the most recently saved first. */
export const publicFeedScopes = ['community', 'following', 'mine', 'saved'] as const;
export type PublicFeedScope = (typeof publicFeedScopes)[number];

export class GetPublicFeedQueryDto {
  @ApiPropertyOptional({ enum: publicFeedScopes, default: 'community' })
  @IsOptional()
  @IsIn(publicFeedScopes)
  scope?: PublicFeedScope;

  @ApiPropertyOptional({
    description: 'Only entries carrying this tag, ignoring case (a feed topic)',
    example: 'gratitude',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/\S/)
  tag?: string;

  @ApiPropertyOptional({
    description:
      'Word search over the entries\' titles, text and tags (never moods or feelings), with the operators of the ' +
      'journal search: "exact phrases", a leading minus to leave a word out, and OR between alternatives.',
    example: 'morning walk',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Only this entry, yours or another writer\'s, whichever tab it would be in, when the feed may show it to you ' +
      '(where a notification leads); `scope` then only names the tab, and a writer you muted is not left out.',
    minimum: 1,
    example: 42,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  entry?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class PublicFeedAuthorDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ description: 'Whether the current user follows this author (an approved follow)' })
  isFollowed: boolean;

  @ApiProperty({
    description: 'Whether the current user asked to follow this author and the request still waits for their approval',
  })
  followRequested: boolean;

  @ApiProperty({
    description: 'Whether this author approves their followers (Followers by approval): following them sends a request',
  })
  approvalRequired: boolean;
}

export class PublicFeedEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  date: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Time of day the author gave the entry (HH:MM)', example: '08:30' })
  timeOfDay: string | null;

  @ApiProperty({ type: [String], description: 'Empty in a teaser (`locked`)' })
  tags: string[];

  @ApiProperty({ description: 'Empty in a teaser (`locked`)' })
  content: string;

  @ApiProperty({ enum: ['plain', 'markdown'] })
  format: 'plain' | 'markdown';

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Comments by active users' })
  commentCount: number;

  @ApiProperty({ description: 'Likes by active users' })
  likeCount: number;

  @ApiProperty({ description: 'Whether the current user likes the entry' })
  liked: boolean;

  @ApiProperty({ description: 'Whether the entry is in the current user’s Saved list' })
  saved: boolean;

  @ApiProperty({
    description:
      'A teaser: the author approves their followers and has not approved the current user, so only the author, ' +
      'the day and the title are given (no text, tags, time of day, likes or comments), and liking, saving or ' +
      'commenting answers `FOLLOW_APPROVAL_REQUIRED` until they approve a follow request',
  })
  locked: boolean;

  @ApiProperty({ type: PublicFeedAuthorDto })
  author: PublicFeedAuthorDto;
}

export class PublicFeedResponseDto {
  @ApiProperty({ type: [PublicFeedEntryDto] })
  entries: PublicFeedEntryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasMore: boolean;
}
