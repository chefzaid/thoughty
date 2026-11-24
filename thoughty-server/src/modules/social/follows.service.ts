import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, type FollowStatus, User, UserFollow } from '@/database/entities';
import { applyPublicFeedVisibility, excludeHiddenWriters } from './public-feed-visibility';
import type {
  FollowApprovalStateDto,
  FollowedUserDto,
  FollowStateDto,
  FollowsResponseDto,
} from './dto';
import { TopicFollowsService } from './topic-follows.service';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly topicFollowsService: TopicFollowsService,
  ) {}

  /**
   * Who the reader follows and asked to follow, the topics they follow, who follows them and asks to (listed to
   * them alone), and whether they approve their followers.
   */
  async list(userId: number): Promise<FollowsResponseDto> {
    const [follows, topics, followers, writer] = await Promise.all([
      this.followRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.followed', 'u')
        .select(['f.followedId', 'f.status', 'f.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
        .where('f.follower_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getMany(),
      this.topicFollowsService.list(userId),
      this.followRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.follower', 'u')
        .select(['f.followerId', 'f.status', 'f.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
        .where('f.followed_id = :userId', { userId })
        .andWhere('u.deleted_at IS NULL')
        .orderBy('u.username', 'ASC')
        .getMany(),
      this.userRepository.findOne({ where: { id: userId }, select: { id: true, followersByApproval: true } }),
    ]);
    const approvedFollowers = followers.filter((follow) => follow.status === 'approved');

    return {
      following: withStatus(follows, 'approved').map((follow) => toFollowedUser(follow.followed, follow.createdAt)),
      requested: withStatus(follows, 'pending').map((follow) => toFollowedUser(follow.followed, follow.createdAt)),
      topics,
      followers: approvedFollowers.map((follow) => toFollowedUser(follow.follower, follow.createdAt)),
      followerCount: approvedFollowers.length,
      requests: withStatus(followers, 'pending').map((follow) => toFollowedUser(follow.follower, follow.createdAt)),
      approvalRequired: writer?.followersByApproval === true,
    };
  }

  /** Approved followers whose accounts are not deleted. */
  countFollowers(userId: number): Promise<number> {
    return this.followRepository
      .createQueryBuilder('f')
      .innerJoin('f.follower', 'u')
      .where('f.followed_id = :userId', { userId })
      .andWhere("f.status = 'approved'")
      .andWhere('u.deleted_at IS NULL')
      .getCount();
  }

  /** Follows a writer, or asks to when they approve their followers (the request then waits as `pending`). */
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

    // The writer's row is read under a share lock, so turning approval off (which approves the waiting
    // requests) cannot pass between reading the switch and storing the follow
    const status = await this.followRepository.manager.transaction(async (manager) => {
      const [writer] = (await manager.query(
        'SELECT followers_by_approval FROM users WHERE id = $1 FOR SHARE',
        [targetUserId],
      )) as { followers_by_approval: boolean }[];
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserFollow)
        .values({
          followerId: userId,
          followedId: targetUserId,
          status: writer?.followers_by_approval ? 'pending' : 'approved',
        })
        .orIgnore()
        .execute();
      const stored = await manager.findOne(UserFollow, {
        where: { followerId: userId, followedId: targetUserId },
        select: { status: true },
      });
      return stored?.status ?? 'pending';
    });
    return toFollowState(targetUserId, status);
  }

  /** Stops following a writer, or withdraws a request still waiting. */
  async unfollow(userId: number, targetUserId: number): Promise<FollowStateDto> {
    await this.followRepository.delete({ followerId: userId, followedId: targetUserId });
    return toFollowState(targetUserId, null);
  }

  /** Drops a follower, or declines a request, without telling them; they may ask again, unless blocked. */
  async removeFollower(userId: number, followerId: number): Promise<FollowStateDto> {
    await this.followRepository.delete({ followerId, followedId: userId });
    return toFollowState(followerId, null);
  }

  /** Approves a request to follow the reader; approving a follower already approved changes nothing. */
  async approveFollower(userId: number, followerId: number): Promise<FollowStateDto> {
    const { affected } = await this.followRepository.update(
      { followerId, followedId: userId, status: 'pending' },
      { status: 'approved' },
    );
    if (!affected) {
      const follows = await this.followRepository.exists({ where: { followerId, followedId: userId } });
      if (!follows) throw apiError(NotFoundException, 'FOLLOW_REQUEST_NOT_FOUND');
    }
    return toFollowState(followerId, 'approved');
  }

  /**
   * Turns Followers by approval on or off. Followers already there stay approved when it is turned on; turning
   * it off approves every request still waiting, as anyone may then follow.
   */
  setApproval(userId: number, required: boolean): Promise<FollowApprovalStateDto> {
    return this.followRepository.manager.transaction(async (manager) => {
      await manager.update(User, { id: userId }, { followersByApproval: required });
      if (required) return { required, approved: 0 };
      const { affected } = await manager.update(
        UserFollow,
        { followedId: userId, status: 'pending' },
        { status: 'approved' },
      );
      return { required, approved: affected ?? 0 };
    });
  }
}

function withStatus(follows: UserFollow[], status: FollowStatus): UserFollow[] {
  return follows.filter((follow) => follow.status === status);
}

function toFollowState(userId: number, status: FollowStatus | null): FollowStateDto {
  return { userId, following: status === 'approved', requested: status === 'pending' };
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
