import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { StrictBoolean } from '@/common/validation';

export class FollowedUserDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({ example: '2026-09-01T08:30:00.000Z', description: 'When the follow, or the request, was made' })
  followedAt!: string;
}

export class FollowedTopicDto {
  @ApiProperty({ example: 'gratitude', description: 'The tag, in lower case' })
  tag!: string;

  @ApiProperty({ example: '2026-09-01T08:30:00.000Z' })
  followedAt!: string;
}

export class FollowsResponseDto {
  @ApiProperty({ type: [FollowedUserDto], description: 'Active users the current user follows (approved follows)' })
  following!: FollowedUserDto[];

  @ApiProperty({
    type: [FollowedUserDto],
    description: 'Active users the current user asked to follow, whose approval is still waited for; each can be withdrawn',
  })
  requested!: FollowedUserDto[];

  @ApiProperty({ type: [FollowedTopicDto], description: 'Topics (tags) the current user follows, by name' })
  topics!: FollowedTopicDto[];

  @ApiProperty({
    type: [FollowedUserDto],
    description:
      'Active users following the current user (approved), by name, listed to them alone; `followedAt` is when each started following',
  })
  followers!: FollowedUserDto[];

  @ApiProperty({ example: 3, description: 'Number of active users following the current user (approved)' })
  followerCount!: number;

  @ApiProperty({
    type: [FollowedUserDto],
    description:
      'Active users asking to follow the current user, by name, listed to them alone, each to approve or decline; `followedAt` is when they asked',
  })
  requests!: FollowedUserDto[];

  @ApiProperty({
    example: false,
    description: 'Followers by approval: whether new follows of the current user wait for their approval',
  })
  approvalRequired!: boolean;
}

export class FollowStateDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: true, description: 'An approved follow' })
  following!: boolean;

  @ApiProperty({
    example: false,
    description: 'A request waiting for the followed writer’s approval (they approve their followers)',
  })
  requested!: boolean;
}

export class FollowApprovalDto {
  @ApiProperty({
    example: true,
    description: 'Whether new follows wait for approval; turning it off approves every request still waiting',
  })
  @StrictBoolean()
  required!: boolean;
}

export class FollowApprovalStateDto {
  @ApiProperty({ example: false })
  required!: boolean;

  @ApiProperty({ example: 2, description: 'Requests approved by turning it off (0 when turned on)' })
  approved!: number;
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
