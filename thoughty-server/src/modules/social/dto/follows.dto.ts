import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

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

export class FollowedTopicDto {
  @ApiProperty({ example: 'gratitude', description: 'The tag, in lower case' })
  tag!: string;

  @ApiProperty({ example: '2026-09-01T08:30:00.000Z' })
  followedAt!: string;
}

export class FollowsResponseDto {
  @ApiProperty({ type: [FollowedUserDto], description: 'Active users the current user follows' })
  following!: FollowedUserDto[];

  @ApiProperty({ type: [FollowedTopicDto], description: 'Topics (tags) the current user follows, by name' })
  topics!: FollowedTopicDto[];

  @ApiProperty({
    type: [FollowedUserDto],
    description:
      'Active users following the current user, by name, listed to them alone; `followedAt` is when each started following',
  })
  followers!: FollowedUserDto[];

  @ApiProperty({ example: 3, description: 'Number of active users following the current user' })
  followerCount!: number;
}

export class FollowStateDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: true })
  following!: boolean;
}

export class TopicParamDto {
  @ApiProperty({ example: 'gratitude', description: 'The tag, matched ignoring case', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @Matches(/\S/)
  tag!: string;
}

export class TopicFollowStateDto {
  @ApiProperty({ example: 'gratitude', description: 'The tag, in lower case' })
  tag!: string;

  @ApiProperty({ example: true })
  following!: boolean;
}
