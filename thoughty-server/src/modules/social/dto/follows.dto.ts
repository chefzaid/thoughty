import { ApiProperty } from '@nestjs/swagger';

export class FollowedUserDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({ example: '2026-09-01T08:30:00.000Z' })
  followedAt!: string;
}

export class FollowsResponseDto {
  @ApiProperty({ type: [FollowedUserDto], description: 'Active users the current user follows' })
  following!: FollowedUserDto[];

  @ApiProperty({ example: 3, description: 'Number of active users following the current user' })
  followerCount!: number;
}

export class FollowStateDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: true })
  following!: boolean;
}
