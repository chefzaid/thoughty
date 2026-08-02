import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { GetPublicFeedQueryDto, PublicFeedResponseDto } from './dto';

@Injectable()
export class PublicFeedService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
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
      ])
      .where('e.visibility = :visibility', { visibility: 'public' })
      .andWhere('e.moderation_status = :moderationStatus', { moderationStatus: 'visible' })
      .andWhere('e.is_archived = false')
      .andWhere('u.deleted_at IS NULL');

    if (scope === 'mine') {
      qb.andWhere('e.user_id = :userId', { userId });
    } else {
      qb.andWhere('e.user_id != :userId', { userId });
    }

    const total = await qb.getCount();
    qb.orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const entries = await qb.getMany();
    const totalPages = Math.ceil(total / limit);

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
        },
      })),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }
}
