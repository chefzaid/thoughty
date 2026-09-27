import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const leaderboardPeriods = ['week', 'month', 'year', 'all'] as const;
export type LeaderboardPeriod = (typeof leaderboardPeriods)[number];

export class GetLeaderboardQueryDto {
  @ApiPropertyOptional({ enum: leaderboardPeriods, default: 'month' })
  @IsOptional()
  @IsIn(leaderboardPeriods)
  period?: LeaderboardPeriod;
}

export class LeaderboardAuthorDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;
}

export class LeaderboardAuthorRankDto {
  @ApiProperty({ type: LeaderboardAuthorDto })
  author!: LeaderboardAuthorDto;

  @ApiProperty({ example: 12, description: 'Public entries published in the period' })
  publicEntries!: number;
}

export class LeaderboardEntryRankDto {
  @ApiProperty({ example: 41 })
  id!: number;

  @ApiProperty({ example: '2026-09-01' })
  date!: string;

  @ApiProperty({ example: 'The first lines of the entry…', description: 'At most 280 characters' })
  excerpt!: string;

  @ApiProperty({ type: LeaderboardAuthorDto })
  author!: LeaderboardAuthorDto;

  @ApiProperty({ example: 7, description: 'Likes, or comments from other people' })
  count!: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ enum: leaderboardPeriods })
  period!: LeaderboardPeriod;

  @ApiProperty({ type: [LeaderboardAuthorRankDto] })
  mostActiveAuthors!: LeaderboardAuthorRankDto[];

  @ApiProperty({ type: [LeaderboardEntryRankDto] })
  mostLikedEntries!: LeaderboardEntryRankDto[];

  @ApiProperty({ type: [LeaderboardEntryRankDto] })
  mostCommentedEntries!: LeaderboardEntryRankDto[];
}
