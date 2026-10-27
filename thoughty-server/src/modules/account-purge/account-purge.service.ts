import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Attachment, User } from '@/database/entities';
import { AttachmentsService } from '@/modules/attachments';

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 50;

export const DEFAULT_ACCOUNT_PURGE_AFTER_DAYS = 30;

/** Days a deleted account waits before it is purged: `ACCOUNT_PURGE_AFTER_DAYS`, a whole number of at least 1. */
export function resolveAccountPurgeAfterDays(value: string | undefined): number | null {
  if (!value?.trim()) {
    return DEFAULT_ACCOUNT_PURGE_AFTER_DAYS;
  }
  const days = Number(value.trim());
  return Number.isInteger(days) && days >= 1 ? days : null;
}

export interface AccountPurgeResult {
  purgedUserIds: number[];
  failedUserIds: number[];
}

/**
 * Deleting an account only signs the writer out and hides them. Once the grace period is over,
 * this removes the account for good: first every file the writer stored in object storage, then
 * the user row, whose foreign keys cascade to everything else they own or wrote (entries and
 * their history, attachments, settings with encrypted tokens, chats, diaries, books, memoir,
 * year reviews, saved searches, life eras, AI usage, sync jobs, follows both ways, their comments
 * and likes on anyone's entries, and their feature requests with every vote on them).
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);
  readonly purgeAfterDays: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly attachmentsService: AttachmentsService,
  ) {
    const days = resolveAccountPurgeAfterDays(process.env.ACCOUNT_PURGE_AFTER_DAYS);
    if (days === null) {
      this.logger.warn(
        `ACCOUNT_PURGE_AFTER_DAYS must be a whole number of days of at least 1; using ${DEFAULT_ACCOUNT_PURGE_AFTER_DAYS}`,
      );
    }
    this.purgeAfterDays = days ?? DEFAULT_ACCOUNT_PURGE_AFTER_DAYS;
  }

  /** Purges, in batches, every account deleted longer ago than the grace period. */
  async purgeExpired(now = new Date()): Promise<AccountPurgeResult> {
    const cutoff = new Date(now.getTime() - this.purgeAfterDays * DAY_MS);
    const result: AccountPurgeResult = { purgedUserIds: [], failedUserIds: [] };
    let afterId = 0;

    for (;;) {
      const users = await this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .select(['u.id'])
        .where('u.deleted_at IS NOT NULL')
        .andWhere('u.deleted_at <= :cutoff', { cutoff })
        .andWhere('u.id > :afterId', { afterId })
        .orderBy('u.id', 'ASC')
        .limit(PURGE_BATCH_SIZE)
        .getMany();

      for (const { id } of users) {
        try {
          if (await this.purgeAccount(id, cutoff)) {
            result.purgedUserIds.push(id);
          }
        } catch (error) {
          result.failedUserIds.push(id);
          this.logger.error(`Failed to purge deleted account ${id}`, error instanceof Error ? error.stack : undefined);
        }
      }

      if (users.length < PURGE_BATCH_SIZE) {
        return result;
      }
      afterId = users[users.length - 1].id;
    }
  }

  /**
   * Locks the account row, which also keeps new rows from referencing it, removes the writer's
   * stored files, then deletes the row. An account another run holds, or one that is gone, is skipped.
   * If any file cannot be deleted, the account is kept and retried on the next run.
   */
  private purgeAccount(userId: number, cutoff: Date): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .select(['u.id'])
        .where('u.id = :userId', { userId })
        .andWhere('u.deleted_at IS NOT NULL')
        .andWhere('u.deleted_at <= :cutoff', { cutoff })
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getOne();
      if (!user) {
        return false;
      }

      const attachments = await manager.find(Attachment, {
        select: { id: true, storedFilename: true },
        where: { userId },
      });
      const failed = await this.attachmentsService.removeStoredFiles(
        attachments.map((attachment) => attachment.storedFilename),
      );
      if (failed.length > 0) {
        // Keep the account, and with it the keys, so the next run deletes the remaining files.
        throw new Error(`${failed.length} stored file(s) could not be deleted`);
      }
      await manager.delete(User, { id: userId });
      return true;
    });
  }
}
