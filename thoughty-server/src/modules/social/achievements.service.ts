import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { Entry, EntryComment } from '@/database/entities';
import type {
  AchievementBadgeDto,
  AchievementMetric,
  AchievementStatsDto,
  AchievementsResponseDto,
} from './dto';
import { FollowsService } from './follows.service';
import { applyPublicFeedVisibility, joinEngagementByOthers } from './public-feed-visibility';

/** Badges in display order; each is earned once its metric reaches the threshold. */
export const BADGES: ReadonlyArray<{ id: string; metric: AchievementMetric; threshold: number }> = [
  { id: 'first-public-entry', metric: 'publicEntries', threshold: 1 },
  { id: 'storyteller', metric: 'publicEntries', threshold: 25 },
  { id: 'hundred-entries', metric: 'totalEntries', threshold: 100 },
  { id: 'week-streak', metric: 'longestStreak', threshold: 7 },
  { id: 'month-streak', metric: 'longestStreak', threshold: 30 },
  { id: 'well-liked', metric: 'likesReceived', threshold: 10 },
  { id: 'beloved', metric: 'likesReceived', threshold: 100 },
  { id: 'conversation-starter', metric: 'commentsReceived', threshold: 10 },
  { id: 'community-voice', metric: 'commentsWritten', threshold: 10 },
  { id: 'connector', metric: 'followers', threshold: 10 },
];

const countRows = async <T extends object>(qb: SelectQueryBuilder<T>): Promise<number> => {
  const row = await qb.select('COUNT(*)', 'count').getRawOne<{ count: string | number }>();
  return Number(row?.count ?? 0);
};

/**
 * The current user's own achievements. Social numbers only count feed-visible content and
 * active accounts; journaling numbers use private data and are never shown to anyone else.
 */
@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    private readonly followsService: FollowsService,
  ) {}

  async getAchievements(userId: number): Promise<AchievementsResponseDto> {
    const [
      publicEntries,
      totalEntries,
      longestStreak,
      entryLikes,
      commentLikes,
      commentsReceived,
      commentsWritten,
      followers,
    ] = await Promise.all([
      this.publicEntriesOf(userId).getCount(),
      this.entryRepository.count({ where: { userId } }),
      this.longestStreak(userId),
      countRows(joinEngagementByOthers(this.publicEntriesOf(userId), 'entry_likes')),
      this.countCommentLikes(userId),
      countRows(joinEngagementByOthers(this.publicEntriesOf(userId), 'entry_comments')),
      this.commentRepository.count({ where: { userId } }),
      this.followsService.countFollowers(userId),
    ]);
    const stats: AchievementStatsDto = {
      publicEntries,
      totalEntries,
      longestStreak,
      likesReceived: entryLikes + commentLikes,
      commentsReceived,
      commentsWritten,
      followers,
    };

    return {
      karma: stats.likesReceived + stats.commentsReceived + stats.followers,
      stats,
      badges: BADGES.map(
        (badge): AchievementBadgeDto => ({
          ...badge,
          progress: Math.min(stats[badge.metric], badge.threshold),
          earned: stats[badge.metric] >= badge.threshold,
        }),
      ),
    };
  }

  private publicEntriesOf(userId: number): SelectQueryBuilder<Entry> {
    return applyPublicFeedVisibility(
      this.entryRepository
        .createQueryBuilder('e')
        .innerJoin('e.user', 'u')
        .where('e.user_id = :userId', { userId }),
    );
  }

  /** Likes by other active users on the user's comments under feed-visible entries. */
  private countCommentLikes(userId: number): Promise<number> {
    return countRows(
      applyPublicFeedVisibility(
        this.entryRepository.createQueryBuilder('e').innerJoin('e.user', 'u'),
      )
        .innerJoin('entry_comments', 'c', 'c.entry_id = e.id AND c.user_id = :userId', { userId })
        .innerJoin('comment_likes', 'x', 'x.comment_id = c.id')
        .innerJoin('users', 'xu', 'xu.id = x.user_id AND xu.deleted_at IS NULL'),
    );
  }

  /** Longest run of consecutive journal dates (gaps-and-islands over distinct dates). */
  private async longestStreak(userId: number): Promise<number> {
    const [row] = await this.entryRepository.query<Array<{ streak: string | number | null }>>(
      `SELECT MAX(run) AS streak FROM (
         SELECT COUNT(*) AS run FROM (
           SELECT day - (ROW_NUMBER() OVER (ORDER BY day))::int AS island
           FROM (SELECT DISTINCT date AS day FROM entries WHERE user_id = $1) days
         ) numbered
         GROUP BY island
       ) runs`,
      [userId],
    );
    return Number(row?.streak ?? 0);
  }
}
