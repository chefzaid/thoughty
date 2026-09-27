import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, UserFollow } from '@/database/entities';
import { applyPublicFeedVisibility } from './public-feed-visibility';
import type { FollowStateDto, FollowsResponseDto } from './dto';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async list(userId: number): Promise<FollowsResponseDto> {
    const [follows, followerCount] = await Promise.all([
      this.followRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.followed', 'u')
        .select(['f.followedId', 'f.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
        .where('f.follower_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getMany(),
      this.followRepository
        .createQueryBuilder('f')
        .innerJoin('f.follower', 'u')
        .where('f.followed_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .getCount(),
    ]);

    return {
      following: follows.map((follow) => ({
        id: follow.followed.id,
        username: follow.followed.username,
        avatarUrl: follow.followed.avatarUrl,
        followedAt: new Date(follow.createdAt).toISOString(),
      })),
      followerCount,
    };
  }

  async follow(userId: number, targetUserId: number): Promise<FollowStateDto> {
    if (userId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    // Only authors visible in the feed can be followed, so ids cannot be probed for private accounts.
    const isPublicAuthor = await applyPublicFeedVisibility(
      this.entryRepository
        .createQueryBuilder('e')
        .innerJoin('e.user', 'u')
        .where('e.user_id = :targetUserId', { targetUserId }),
    ).getExists();
    if (!isPublicAuthor) {
      throw new NotFoundException('User not found');
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
}
