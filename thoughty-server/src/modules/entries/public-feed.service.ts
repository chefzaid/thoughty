import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, UserFollow } from '@/database/entities';
import type { GetPublicFeedQueryDto, PublicFeedResponseDto } from './dto';
import { applyPublicFeedVisibility } from './public-feed-visibility';

@Injectable()
export class PublicFeedService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
  ) {}

  async getFeed(userId: number, query: GetPublicFeedQueryDto): Promise<PublicFeedResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const scope = query.scope ?? 'community';
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .select([
        'e.id',
        'e.date',
        'e.index',
        'e.tags',
        'e.content',
        'e.format',
        'e.createdAt',
        'u.id',
        'u.username',
        'u.avatarUrl',
      ]);
    applyPublicFeedVisibility(qb);

    if (scope === 'mine') {
      qb.andWhere('e.user_id = :userId', { userId });
    } else if (scope === 'following') {
      qb.andWhere(
        'e.user_id IN (SELECT f.followed_id FROM user_follows f WHERE f.follower_id = :userId)',
        { userId },
      );
    } else {
      qb.andWhere('e.user_id != :userId', { userId });
    }

    const total = await qb.getCount();
    qb.orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const entries = await qb.getMany();
    const totalPages = Math.ceil(total / limit);
    const followedIds = await this.findFollowedAuthorIds(
      userId,
      entries.map((entry) => entry.user.id),
    );

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        index: entry.index,
        tags: entry.tags,
        content: entry.content,
        format: entry.format,
        createdAt: entry.createdAt,
        author: {
          id: entry.user.id,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
          isFollowed: followedIds.has(entry.user.id),
        },
      })),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  private async findFollowedAuthorIds(userId: number, authorIds: number[]): Promise<Set<number>> {
    const candidates = [...new Set(authorIds)].filter((authorId) => authorId !== userId);
    if (candidates.length === 0) return new Set();

    const follows = await this.followRepository.find({
      where: { followerId: userId, followedId: In(candidates) },
      select: { followedId: true },
    });
    return new Set(follows.map((follow) => follow.followedId));
  }
}
