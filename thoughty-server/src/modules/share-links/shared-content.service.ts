import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { Attachment, BookVersion, Entry, ShareLink } from '@/database/entities';
import { describeStoredFile, type StoredAttachmentFile } from '@/modules/attachments/attachment-media';
import { SharedContentResponseDto, SharedEntryDto } from './dto';
import { shareTokenHashOf } from './share-link-token';

/** After the last view a limited link allows, the pictures of that view still load for this long. */
const LAST_VIEW_FILE_GRACE = "interval '1 hour'";

/** A link that still works, with what it shares. */
interface LiveShareLink {
  id: number;
  userId: number;
  entryId: number | null;
  bookVersionId: number | null;
  showMood: boolean;
  showTags: boolean;
  expiresAt: Date;
  /** Whether it may be opened (or its book downloaded) once more. */
  viewsLeft: boolean;
  /** Whether its last allowed view was a moment ago, so that view's pictures still load. */
  justViewed: boolean;
}

interface LiveShareLinkRow {
  id: number;
  user_id: number;
  entry_id: number | null;
  book_version_id: number | null;
  show_mood: boolean;
  show_tags: boolean;
  expires_at: Date;
  views_left: boolean;
  just_viewed: boolean;
}

/** The shared book file, as the download sends it. */
export interface SharedBookFile {
  content: Buffer;
  filename: string;
  contentType: string;
}

/** Every refusal reads the same, so a reader cannot tell a revoked or expired link from one that never existed. */
const notFound = () => apiError(NotFoundException, 'SHARE_LINK_NOT_FOUND');

/**
 * What a private share link shows to whoever holds it, without signing in. A link works while it has
 * not expired, its writer's account is not deleted, and its entry is neither in the recycle bin nor a
 * sealed time capsule (binning or sealing an entry deletes its links; the check here is the second
 * line). Opening an entry or downloading a book counts a view, refused once a limited link has none
 * left. Only the entry's own files are served, by attachment ID, never the authenticated file route.
 */
@Injectable()
export class SharedContentService {
  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(BookVersion)
    private readonly bookVersionRepository: Repository<BookVersion>,
  ) {}

  /** The shared entry (counting a view) or the shared book's description. */
  async open(token: string): Promise<SharedContentResponseDto> {
    const link = await this.findLive(token);
    if (link.bookVersionId !== null) {
      if (!link.viewsLeft) throw notFound();
      return { kind: 'bookVersion', expiresAt: link.expiresAt, entry: null, bookVersion: await this.describeBook(link.bookVersionId) };
    }
    await this.countView(link);
    return { kind: 'entry', expiresAt: link.expiresAt, entry: await this.loadEntry(link), bookVersion: null };
  }

  /** The shared book's stored file, counting a view. */
  async downloadBook(token: string): Promise<SharedBookFile> {
    const link = await this.findLive(token);
    if (link.bookVersionId === null) throw notFound();
    await this.countView(link);
    const version = await this.bookVersionRepository
      .createQueryBuilder('version')
      .select(['version.id', 'version.filename', 'version.contentType'])
      .addSelect('version.content')
      .where('version.id = :id', { id: link.bookVersionId })
      .getOne();
    if (!version) throw notFound();
    return { content: version.content, filename: version.filename, contentType: version.contentType };
  }

  /** One file of the shared entry: an attachment, or a video's poster frame. */
  async attachmentFile(token: string, attachmentId: number, part: 'file' | 'poster'): Promise<StoredAttachmentFile> {
    const link = await this.findLive(token);
    if (link.entryId === null || !(link.viewsLeft || link.justViewed)) throw notFound();
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, entryId: link.entryId, userId: link.userId },
    });
    const key = part === 'poster' ? attachment?.posterFilename : attachment?.storedFilename;
    if (!attachment || !key) throw notFound();
    return describeStoredFile(attachment, key);
  }

  private async findLive(token: string): Promise<LiveShareLink> {
    const tokenHash = shareTokenHashOf(token);
    if (tokenHash === null) throw notFound();
    const rows: LiveShareLinkRow[] = await this.shareLinkRepository.query(
      `SELECT l.id, l.user_id, l.entry_id, l.book_version_id, l.show_mood, l.show_tags, l.expires_at,
              (l.max_views IS NULL OR l.view_count < l.max_views) AS views_left,
              COALESCE(l.last_viewed_at > now() - ${LAST_VIEW_FILE_GRACE}, false) AS just_viewed
         FROM share_links l
         JOIN users u ON u.id = l.user_id AND u.deleted_at IS NULL
         LEFT JOIN entries e ON e.id = l.entry_id AND e.user_id = l.user_id
                            AND e.deleted_at IS NULL AND e.sealed_until IS NULL
         LEFT JOIN book_versions b ON b.id = l.book_version_id AND b.user_id = l.user_id
        WHERE l.token_hash = $1
          AND l.expires_at > now()
          AND (e.id IS NOT NULL OR b.id IS NOT NULL)`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) throw notFound();
    return {
      id: row.id,
      userId: row.user_id,
      entryId: row.entry_id,
      bookVersionId: row.book_version_id,
      showMood: row.show_mood,
      showTags: row.show_tags,
      expiresAt: row.expires_at,
      viewsLeft: row.views_left,
      justViewed: row.just_viewed,
    };
  }

  /** Counts a view in one statement, so concurrent readers cannot pass the link's limit. */
  private async countView(link: LiveShareLink): Promise<void> {
    const result = await this.shareLinkRepository
      .createQueryBuilder()
      .update(ShareLink)
      .set({ viewCount: () => 'view_count + 1', lastViewedAt: () => 'now()' })
      .where('id = :id', { id: link.id })
      .andWhere('expires_at > now()')
      .andWhere('(max_views IS NULL OR view_count < max_views)')
      .execute();
    if (!result.affected) throw notFound();
  }

  private async loadEntry(link: LiveShareLink): Promise<SharedEntryDto> {
    const entry = await this.entryRepository.findOne({
      where: { id: link.entryId!, userId: link.userId },
      relations: { attachments: true },
    });
    if (!entry || entry.sealedUntil) throw notFound();
    return {
      date: entry.date,
      timeOfDay: entry.timeOfDay ?? null,
      title: entry.title ?? null,
      content: entry.content,
      format: entry.format,
      mood: link.showMood ? entry.mood ?? null : null,
      feelings: link.showMood ? entry.feelings ?? [] : [],
      tags: link.showTags ? entry.tags : [],
      attachments: [...(entry.attachments ?? [])]
        .sort((left, right) => left.id - right.id)
        .map((attachment) => ({
          id: attachment.id,
          name: attachment.originalFilename,
          mimetype: attachment.mimetype,
          size: attachment.size,
          hasPoster: Boolean(attachment.posterFilename),
        })),
    };
  }

  private async describeBook(bookVersionId: number) {
    const rows: { title: string; author: string | null; format: string; filename: string; size: number }[] =
      await this.bookVersionRepository.query(
        'SELECT title, author, format, filename, octet_length(content)::int AS size FROM book_versions WHERE id = $1',
        [bookVersionId],
      );
    const version = rows[0];
    if (!version) throw notFound();
    return version;
  }
}
