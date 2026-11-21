import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, type User, UserFollow } from '@/database/entities';
import { applyPublicFeedVisibility, excludeHiddenWriters } from './public-feed-visibility';
import type { FollowedUserDto, FollowStateDto, FollowsResponseDto } from './dto';
import { TopicFollowsService } from './topic-follows.service';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly topicFollowsService: TopicFollowsService,
  ) {}

  /** Who the reader follows, the topics they follow, and who follows them (listed to them alone). */
  async list(userId: number): Promise<FollowsResponseDto> {
    const [follows, topics, followers] = await Promise.all([
      this.followRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.followed', 'u')
        .select(['f.followedId', 'f.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
        .where('f.follower_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getMany(),
      this.topicFollowsService.list(userId),
      this.followRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.follower', 'u')
        .select(['f.followerId', 'f.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
        .where('f.followed_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getMany(),
    ]);

    return {
      following: follows.map((follow) => toFollowedUser(follow.followed, follow.createdAt)),
      topics,
      followers: followers.map((follow) => toFollowedUser(follow.follower, follow.createdAt)),
      followerCount: followers.length,
    };
  }

  /** Followers whose accounts are not deleted. */
  countFollowers(userId: number): Promise<number> {
    return this.followRepository
      .createQueryBuilder('f')
      .innerJoin('f.follower', 'u')
      .where('f.followed_id = :userId', { userId })
      .andWhere('u.deleted_at IS NULL')
      .getCount();
  }

  async follow(userId: number, targetUserId: number): Promise<FollowStateDto> {
    if (userId === targetUserId) {
      throw apiError(BadRequestException, 'SOCIAL_CANNOT_FOLLOW_SELF');
    }
    // Only authors visible in the feed can be followed, so ids cannot be probed for private accounts; a
    // writer blocked either way is not visible to the other, so neither can follow the other.
    const isPublicAuthor = await excludeHiddenWriters(
      applyPublicFeedVisibility(
        this.entryRepository
          .createQueryBuilder('e')
          .innerJoin('e.user', 'u')
          .where('e.user_id = :targetUserId', { targetUserId }),
      ),
      'e.user_id',
      userId,
    ).getExists();
    if (!isPublicAuthor) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }

    await this.followRepository
      .createQueryBuilder()
      .insert()
      .into(UserFollow)
      .values({ followerId: userId, followedId: targetUserId })
      .orIgnore()
      .execute();
    return { userId: targetUserId, following: true };
  }

  async unfollow(userId: number, targetUserId: number): Promise<FollowStateDto> {
    await this.followRepository.delete({ followerId: userId, followedId: targetUserId });
    return { userId: targetUserId, following: false };
  }

  /** Drops a follower without telling them; they may follow again, unless blocked. */
  async removeFollower(userId: number, followerId: number): Promise<FollowStateDto> {
    await this.followRepository.delete({ followerId, followedId: userId });
    return { userId: followerId, following: false };
  }
}

function toFollowedUser(
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>,
  since: Date,
): FollowedUserDto {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    followedAt: new Date(since).toISOString(),
  };
}
