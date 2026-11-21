import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type ObjectLiteral, Repository, type SelectQueryBuilder } from 'typeorm';
import { apiError } from '@/common/errors';
import { Entry, UserBlock, UserFollow, UserMute } from '@/database/entities';
import { applyPublicFeedVisibility } from './public-feed-visibility';
import type {
  HiddenWriterDto,
  HiddenWritersResponseDto,
  WriterBlockStateDto,
  WriterMuteStateDto,
} from './dto';

interface HiddenWriterRow {
  id: number;
  username: string;
  avatarUrl: string | null;
  since: Date;
}

/** The muted or blocked writer (alias `u`) and when the row (alias `row`) was made. */
function selectHiddenWriter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  row: string,
): SelectQueryBuilder<T> {
  return qb
    .select('u.id', 'id')
    .addSelect('u.username', 'username')
    .addSelect('u.avatar_url', 'avatarUrl')
    .addSelect(`${row}.created_at`, 'since');
}

const toHiddenWriter = (row: HiddenWriterRow): HiddenWriterDto => ({
  id: Number(row.id),
  username: row.username,
  avatarUrl: row.avatarUrl,
  since: new Date(row.since).toISOString(),
});

/**
 * Muting and blocking other writers. Neither is ever shown to the writer it names: to a blocked writer,
 * the one who blocked them is simply no longer there.
 */
@Injectable()
export class WriterControlsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(UserMute)
    private readonly muteRepository: Repository<UserMute>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
  ) {}

  /** The writers the reader muted and blocked, by name, for Profile › Privacy. */
  async list(userId: number): Promise<HiddenWritersResponseDto> {
    const [muted, blocked] = await Promise.all([
      selectHiddenWriter(this.muteRepository.createQueryBuilder('m').innerJoin('m.muted', 'u'), 'm')
        .where('m.user_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getRawMany<HiddenWriterRow>(),
      selectHiddenWriter(
        this.blockRepository.createQueryBuilder('b').innerJoin('b.blocked', 'u'),
        'b',
      )
        .where('b.blocker_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getRawMany<HiddenWriterRow>(),
    ]);
    return { muted: muted.map(toHiddenWriter), blocked: blocked.map(toHiddenWriter) };
  }

  async setMuted(userId: number, targetUserId: number, mute: boolean): Promise<WriterMuteStateDto> {
    if (mute) {
      await this.assertReachable(userId, targetUserId, 'SOCIAL_CANNOT_MUTE_SELF');
      await this.muteRepository
        .createQueryBuilder()
        .insert()
        .into(UserMute)
        .values({ userId, mutedId: targetUserId })
        .orIgnore()
        .execute();
    } else {
      await this.muteRepository.delete({ userId, mutedId: targetUserId });
    }
    return { userId: targetUserId, muted: mute };
  }

  /**
   * A block ends the follows both ways and takes each writer's entries out of the other's Saved list, in
   * one transaction; the block itself then keeps them apart. Unblocking brings neither back.
   */
  async setBlocked(
    userId: number,
    targetUserId: number,
    block: boolean,
  ): Promise<WriterBlockStateDto> {
    if (!block) {
      await this.blockRepository.delete({ blockerId: userId, blockedId: targetUserId });
      return { userId: targetUserId, blocked: false };
    }

    await this.assertReachable(userId, targetUserId, 'SOCIAL_CANNOT_BLOCK_SELF');
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserBlock)
        .values({ blockerId: userId, blockedId: targetUserId })
        .orIgnore()
        .execute();
      await manager.query(
        `DELETE FROM user_follows
          WHERE (follower_id = $1 AND followed_id = $2) OR (follower_id = $2 AND followed_id = $1)`,
        [userId, targetUserId],
      );
      await manager.query(
        `DELETE FROM saved_entries s USING entries e
          WHERE e.id = s.entry_id
            AND ((s.user_id = $1 AND e.user_id = $2) OR (s.user_id = $2 AND e.user_id = $1))`,
        [userId, targetUserId],
      );
    });
    return { userId: targetUserId, blocked: true };
  }

  /**
   * Only a writer the reader can come across may be muted or blocked: the author of a feed entry or of a
   * comment on one, or a follower. Any other id answers as missing, so accounts cannot be probed.
   */
  private async assertReachable(
    userId: number,
    targetUserId: number,
    selfCode: 'SOCIAL_CANNOT_MUTE_SELF' | 'SOCIAL_CANNOT_BLOCK_SELF',
  ): Promise<void> {
    if (userId === targetUserId) {
      throw apiError(BadRequestException, selfCode);
    }
    const [writesInFeed, follows] = await Promise.all([
      applyPublicFeedVisibility(
        this.entryRepository
          .createQueryBuilder('e')
          .innerJoin('e.user', 'u')
          .where(
            `(e.user_id = :targetUserId OR EXISTS (
              SELECT 1 FROM entry_comments c
                JOIN users cu ON cu.id = c.user_id AND cu.deleted_at IS NULL
               WHERE c.entry_id = e.id AND c.user_id = :targetUserId
            ))`,
            { targetUserId },
          ),
      ).getExists(),
      this.followRepository
        .createQueryBuilder('f')
        .innerJoin('f.follower', 'u')
        .where('f.follower_id = :targetUserId', { targetUserId })
        .andWhere('f.followed_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .getExists(),
    ]);
    if (!writesInFeed && !follows) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }
  }
}
