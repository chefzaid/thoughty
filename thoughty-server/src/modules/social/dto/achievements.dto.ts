import { ApiProperty } from '@nestjs/swagger';

export const achievementMetrics = [
  'publicEntries',
  'totalEntries',
  'longestStreak',
  'likesReceived',
  'commentsReceived',
  'commentsWritten',
  'followers',
] as const;
export type AchievementMetric = (typeof achievementMetrics)[number];

export class AchievementStatsDto {
  @ApiProperty({ example: 12, description: 'Entries currently visible in the public feed' })
  publicEntries!: number;

  @ApiProperty({ example: 340, description: 'All journal entries, private ones included' })
  totalEntries!: number;

  @ApiProperty({ example: 9, description: 'Most consecutive days with at least one entry' })
  longestStreak!: number;

  @ApiProperty({ example: 21, description: 'Likes on your public entries and comments' })
  likesReceived!: number;

  @ApiProperty({ example: 6, description: 'Comments from other people on your public entries' })
  commentsReceived!: number;

  @ApiProperty({ example: 4 })
  commentsWritten!: number;

  @ApiProperty({ example: 3 })
  followers!: number;
}

export class AchievementBadgeDto {
  @ApiProperty({ example: 'well-liked' })
  id!: string;

  @ApiProperty({ enum: achievementMetrics })
  metric!: AchievementMetric;

  @ApiProperty({ example: 10 })
  threshold!: number;

  @ApiProperty({ example: 7, description: 'Current value of the metric, capped at the threshold' })
  progress!: number;

  @ApiProperty({ example: false })
  earned!: boolean;
}

export class AchievementsResponseDto {
  @ApiProperty({
    example: 30,
    description: 'Likes received plus comments received plus followers',
  })
  karma!: number;

  @ApiProperty({ type: AchievementStatsDto })
  stats!: AchievementStatsDto;

  @ApiProperty({ type: [AchievementBadgeDto] })
  badges!: AchievementBadgeDto[];
}
