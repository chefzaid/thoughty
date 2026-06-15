import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, Diary, User } from '@/database/entities';
import { AiBookComposerService, type BookWeavingMode } from '@/modules/ai';
import {
  Book,
  buildBook,
  renderBookMarkdown,
  renderBookHtml,
  renderBookPdf,
  renderBookEpub,
} from '@/common/utils';
import { BookQueryDto, BookPreviewResponseDto } from './dto';

export type BookFormat = 'pdf' | 'epub' | 'html' | 'md';

export interface BookFile {
  content: Buffer | string;
  filename: string;
  contentType: string;
}

const DEFAULT_BOOK_TITLE = 'My Book of Thoughts';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly aiBookComposer: AiBookComposerService,
  ) {}

  private async fetchEntries(userId: number, query: BookQueryDto): Promise<Entry[]> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.is_archived = false')
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC');

    if (query.diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId: query.diaryId });
    }
    if (query.dateFrom) {
      qb.andWhere('e.date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('e.date <= :dateTo', { dateTo: query.dateTo });
    }

    return qb.getMany();
  }

  private async resolveDiary(userId: number, diaryId?: number): Promise<Diary | null> {
    if (!diaryId) {
      return null;
    }

    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    if (!diary) {
      throw new NotFoundException('Diary not found');
    }
    return diary;
  }

  private async resolveAuthor(userId: number, provided?: string): Promise<string | undefined> {
    if (provided?.trim()) {
      return provided.trim();
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.username;
  }

  private parseTagFilter(tags?: string): string[] | undefined {
    const parsed = tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return parsed?.length ? parsed : undefined;
  }

  async buildBookForUser(userId: number, query: BookQueryDto): Promise<Book> {
    const [diary, entries, author] = await Promise.all([
      this.resolveDiary(userId, query.diaryId),
      this.fetchEntries(userId, query),
      this.resolveAuthor(userId, query.author),
    ]);

    const title = query.title?.trim() || diary?.name || DEFAULT_BOOK_TITLE;

    return buildBook(entries, {
      title,
      author,
      chapterOrder: query.chapterOrder,
      tagScope: query.tagScope,
      includeUntagged: query.includeUntagged,
      tags: this.parseTagFilter(query.tags),
    });
  }

  async preview(userId: number, query: BookQueryDto): Promise<BookPreviewResponseDto> {
    const book = await this.buildBookForUser(userId, query);

    return {
      title: book.title,
      author: book.author,
      chapterCount: book.chapters.length,
      entryCount: book.chapters.reduce((sum, chapter) => sum + chapter.entries.length, 0),
      chapters: book.chapters.map((chapter) => ({
        title: chapter.title,
        entryCount: chapter.entries.length,
        firstDate: chapter.entries[0].date,
        lastDate: chapter.entries.at(-1)?.date ?? chapter.entries[0].date,
      })),
    };
  }

  private async composeNarratives(userId: number, book: Book, mode: BookWeavingMode): Promise<void> {
    if (!this.aiBookComposer.isConfigured()) {
      throw new BadRequestException(
        'AI narrative requires an OpenRouter API key on the server. Disable the AI narrative option to download a plain book.',
      );
    }

    for (const chapter of book.chapters) {
      chapter.narrative = await this.aiBookComposer.composeBookChapter(
        userId,
        chapter.title,
        chapter.entries.map((entry) => ({ date: entry.date, content: entry.content })),
        mode,
      );
    }
  }

  async export(userId: number, query: BookQueryDto): Promise<BookFile> {
    const book = await this.buildBookForUser(userId, query);
    if (query.narrative !== false) {
      await this.composeNarratives(userId, book, query.weavingMode ?? 'strict');
    }
    const format: BookFormat = query.format || 'pdf';
    const renderOptions = {
      includeDates: query.includeDates,
      includeToc: query.includeToc,
    };

    const titleLabel = book.title.replaceAll(/[^a-zA-Z0-9_-]/g, '_') || 'book';
    const dateStr = new Date().toISOString().split('T')[0];

    let content: Buffer | string;
    let extension: string;
    let contentType: string;

    switch (format) {
      case 'md':
        content = renderBookMarkdown(book, renderOptions);
        extension = 'md';
        contentType = 'text/markdown; charset=utf-8';
        break;
      case 'html':
        content = renderBookHtml(book, renderOptions);
        extension = 'html';
        contentType = 'text/html; charset=utf-8';
        break;
      case 'epub':
        content = await renderBookEpub(book, renderOptions);
        extension = 'epub';
        contentType = 'application/epub+zip';
        break;
      default:
        content = await renderBookPdf(book, renderOptions);
        extension = 'pdf';
        contentType = 'application/pdf';
        break;
    }

    return {
      content,
      filename: `thoughty_book_${titleLabel}_${dateStr}.${extension}`,
      contentType,
    };
  }
}
