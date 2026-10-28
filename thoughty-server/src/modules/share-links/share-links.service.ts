import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { BookVersion, Entry, ShareLink } from '@/database/entities';
import { assertEntryNotSealed } from '@/modules/time-capsules/time-capsule.guard';
import {
  CreateShareLinkDto,
  CreatedShareLinkResponseDto,
  SHARE_LINK_LIMIT,
  SHARE_LINK_MAX_DAYS,
  SHARE_LINK_MIN_MINUTES,
  ShareLinkListResponseDto,
  ShareLinkResponseDto,
  type ShareLinkKind,
} from './dto';
import { createShareToken, hashShareToken } from './share-link-token';

/** Namespace of the advisory lock that serializes one writer's new links, so the limit holds under concurrent requests. */
const SHARE_LINK_LOCK_NAMESPACE = 'share_links';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** The link's target as the table holds it. */
function targetColumns(kind: ShareLinkKind, targetId: number): Pick<ShareLink, 'entryId' | 'bookVersionId'> {
  return kind === 'entry' ? { entryId: targetId, bookVersionId: null } : { entryId: null, bookVersionId: targetId };
}

/** The column that names the link's target, to find the links of one entry or book version. */
function targetWhere(kind: ShareLinkKind, targetId: number): { entryId: number } | { bookVersionId: number } {
  return kind === 'entry' ? { entryId: targetId } : { bookVersionId: targetId };
}

/** A link as its writer sees it, without its token. */
export function toShareLinkResponse(link: ShareLink): ShareLinkResponseDto {
  return {
    id: link.id,
    kind: link.entryId === null ? 'bookVersion' : 'entry',
    targetId: (link.entryId ?? link.bookVersionId)!,
    label: link.label,
    showMood: link.showMood,
    showTags: link.showTags,
    maxViews: link.maxViews,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
  };
}

/**
 * The writer's private share links: making one for an entry or a book version of their own, listing
 * those that have not expired, and revoking one, which deletes it. Expired links are deleted as the
 * writer next makes or lists links.
 */
@Injectable()
export class ShareLinksService {
  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
  ) {}

  async create(userId: number, dto: CreateShareLinkDto, now = new Date()): Promise<CreatedShareLinkResponseDto> {
    const expiresAt = this.checkExpiry(dto.expiresAt, now);
    const token = createShareToken();
    const link = await this.shareLinkRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [SHARE_LINK_LOCK_NAMESPACE, userId]);
      await this.assertShareable(manager, userId, dto.kind, dto.targetId);

      const repository = manager.getRepository(ShareLink);
      await this.deleteExpired(repository, userId);
      if ((await repository.count({ where: { userId } })) >= SHARE_LINK_LIMIT) {
        throw apiError(BadRequestException, 'SHARE_LINK_LIMIT_REACHED', `Share link limit reached (${SHARE_LINK_LIMIT})`);
      }

      const isEntry = dto.kind === 'entry';
      return repository.save(repository.create({
        userId,
        ...targetColumns(dto.kind, dto.targetId),
        tokenHash: hashShareToken(token),
        label: dto.label ?? null,
        // Mood and tags belong to entries; a book is shared as its file
        showMood: isEntry && dto.showMood === true,
        showTags: isEntry && dto.showTags === true,
        maxViews: dto.maxViews ?? null,
        expiresAt,
      }));
    });
    return { ...toShareLinkResponse(link), token };
  }

  /** The unexpired links of one of the writer's entries (not in the recycle bin) or book versions, newest first. */
  async list(userId: number, kind: ShareLinkKind, targetId: number): Promise<ShareLinkListResponseDto> {
    await this.assertOwnTarget(this.shareLinkRepository.manager, userId, kind, targetId);
    await this.deleteExpired(this.shareLinkRepository, userId);
    const [links, activeCount] = await Promise.all([
      this.shareLinkRepository.find({
        where: { userId, ...targetWhere(kind, targetId), expiresAt: MoreThan(new Date()) },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.shareLinkRepository.count({ where: { userId, expiresAt: MoreThan(new Date()) } }),
    ]);
    return { links: links.map(toShareLinkResponse), limit: SHARE_LINK_LIMIT, activeCount };
  }

  /** Revokes a link by deleting it: its token then reads like one that never existed. */
  async revoke(userId: number, id: number): Promise<{ success: boolean }> {
    const result = await this.shareLinkRepository.delete({ id, userId });
    if (!result.affected) {
      throw apiError(NotFoundException, 'SHARE_LINK_NOT_FOUND');
    }
    return { success: true };
  }

  private checkExpiry(value: string, now: Date): Date {
    const expiresAt = new Date(value);
    const ahead = expiresAt.getTime() - now.getTime();
    if (!(ahead >= SHARE_LINK_MIN_MINUTES * MINUTE_MS && ahead <= SHARE_LINK_MAX_DAYS * DAY_MS)) {
      throw apiError(BadRequestException, 'SHARE_LINK_EXPIRY_INVALID');
    }
    return expiresAt;
  }

  /** A sealed time capsule cannot be shared until it opens; neither can an entry in the recycle bin (it is not found). */
  private async assertShareable(manager: EntityManager, userId: number, kind: ShareLinkKind, targetId: number): Promise<void> {
    if (kind === 'entry') {
      const entry = await manager.getRepository(Entry).findOne({ select: { id: true, sealedUntil: true }, where: { id: targetId, userId } });
      if (!entry) throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
      assertEntryNotSealed(entry);
      return;
    }
    await this.assertOwnTarget(manager, userId, kind, targetId);
  }

  private async assertOwnTarget(manager: EntityManager, userId: number, kind: ShareLinkKind, targetId: number): Promise<void> {
    if (kind === 'entry') {
      if (!(await manager.getRepository(Entry).exists({ where: { id: targetId, userId } }))) {
        throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
      }
    } else if (!(await manager.getRepository(BookVersion).exists({ where: { id: targetId, userId } }))) {
      throw apiError(NotFoundException, 'BOOK_VERSION_NOT_FOUND');
    }
  }

  private async deleteExpired(repository: Repository<ShareLink>, userId: number): Promise<void> {
    await repository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('expires_at <= now()')
      .execute();
  }
}
