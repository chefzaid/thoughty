import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import {
  COMMENT_POLICIES,
  type CommentPolicy,
  type Entry,
  Setting,
  UserFollow,
} from '@/database/entities';

/** The Profile setting an entry without a policy of its own follows. */
export const DEFAULT_COMMENT_POLICY_SETTING = 'defaultCommentPolicy';

export type CommentPolicyEntry = Pick<Entry, 'userId' | 'commentPolicy'>;

export interface CommentPolicyState {
  commentPolicy: CommentPolicy;
  canComment: boolean;
}

function isCommentPolicy(value: string | undefined): value is CommentPolicy {
  return (COMMENT_POLICIES as readonly string[]).includes(value ?? '');
}

/** Who may comment on a public entry: its own choice, else its writer's default, else everyone. */
@Injectable()
export class CommentPolicyService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
  ) {}

  async effectivePolicy(entry: CommentPolicyEntry): Promise<CommentPolicy> {
    if (entry.commentPolicy) return entry.commentPolicy;

    const setting = await this.settingRepository.findOne({
      where: { userId: entry.userId, key: DEFAULT_COMMENT_POLICY_SETTING },
      select: { value: true },
    });
    return isCommentPolicy(setting?.value) ? setting.value : 'everyone';
  }

  /** The entry's policy and whether `userId` may comment under it; its writer may whenever it is open. */
  async stateFor(userId: number, entry: CommentPolicyEntry): Promise<CommentPolicyState> {
    const commentPolicy = await this.effectivePolicy(entry);
    return {
      commentPolicy,
      canComment: await this.mayComment(userId, entry.userId, commentPolicy),
    };
  }

  async assertMayComment(userId: number, entry: CommentPolicyEntry): Promise<void> {
    const { commentPolicy, canComment } = await this.stateFor(userId, entry);
    if (canComment) return;
    throw apiError(
      ForbiddenException,
      commentPolicy === 'closed' ? 'COMMENTS_CLOSED' : 'COMMENTS_FOLLOWERS_ONLY',
    );
  }

  private async mayComment(
    userId: number,
    writerId: number,
    policy: CommentPolicy,
  ): Promise<boolean> {
    if (policy === 'closed') return false;
    if (policy === 'everyone' || userId === writerId) return true;
    // A request still waiting for the writer's approval is not a follow yet
    return this.followRepository.exists({
      where: { followerId: userId, followedId: writerId, status: 'approved' },
    });
  }
}
