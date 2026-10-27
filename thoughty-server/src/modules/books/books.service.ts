import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/database/entities';
import { AiBookComposerService, type BookWeavingMode } from '@/modules/ai';
import {
  Book,
  buildBook,
  renderBookMarkdown,
  renderBookHtml,
  renderBookPdf,
  renderBookEpub,
  hydrateBookImages,
  inlineImagesToAltText,
} from '@/common/utils';
import { BookQueryDto, BookPreviewResponseDto } from './dto';
import type { BookVersionManifest, BookVersionSource } from '@/database/entities';
import { createBookCover } from './book-cover.util';
import { AttachmentsService } from '@/modules/attachments';
import { BookEntrySourceService } from './book-entry-source.service';
import { LifeErasService } from '@/modules/life-eras';

export type BookFormat = 'pdf' | 'epub' | 'html' | 'md';

export interface BookFile {
  content: Buffer | string;
  filename: string;
  contentType: string;
  title: string;
  author?: string;
  sourceManifest: BookVersionManifest;
  /** Where the entries came from, recorded with a saved version. */
  source: BookVersionSource;
}

/** A built book and where its entries came from. */
interface SourcedBook {
  book: Book;
  source: BookVersionSource;
}

const DEFAULT_BOOK_TITLE = 'My Book of Thoughts';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly entrySource: BookEntrySourceService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly aiBookComposer: AiBookComposerService,
    private readonly attachmentsService: AttachmentsService,
    private readonly lifeEras: LifeErasService,
  ) {}

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
    return (await this.buildSourcedBook(userId, query)).book;
  }

  private async buildSourcedBook(userId: number, query: BookQueryDto): Promise<SourcedBook> {
    const [{ entries, source, defaultTitle }, author, eras] = await Promise.all([
      this.entrySource.select(userId, query),
      this.resolveAuthor(userId, query.author),
      query.chapterMode === 'eras' ? this.lifeEras.findAll(userId) : Promise.resolve([]),
    ]);

    const title = query.title?.trim() || defaultTitle || DEFAULT_BOOK_TITLE;

    const book = buildBook(entries, {
      title,
      author,
      chapterMode: query.chapterMode,
      chapterOrder: query.chapterOrder,
      tagScope: query.tagScope,
      includeUntagged: query.includeUntagged,
      tags: this.parseTagFilter(query.tags),
      eras,
    });
    return { book, source };
  }

  async preview(userId: number, query: BookQueryDto): Promise<BookPreviewResponseDto> {
    const book = await this.buildBookForUser(userId, {
      ...query,
      embedImages: false,
    });

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

  private async composeNarratives(
    userId: number,
    book: Book,
    mode: BookWeavingMode,
  ): Promise<void> {
    if (!(await this.aiBookComposer.isConfigured(userId))) {
      throw apiError(BadRequestException, 'BOOK_AI_NARRATIVE_KEY_REQUIRED');
    }

    for (const chapter of book.chapters) {
      chapter.narrative = await this.aiBookComposer.composeBookChapter(
        userId,
        chapter.title,
        chapter.entries.map((entry) => ({ date: entry.date, content: inlineImagesToAltText(entry.content) })),
        mode,
      );
    }
  }

  private async composeChapterFraming(userId: number, book: Book): Promise<void> {
    if (!(await this.aiBookComposer.isConfigured(userId))) {
      throw apiError(BadRequestException, 'BOOK_AI_FRAMING_KEY_REQUIRED');
    }

    for (const chapter of book.chapters) {
      const framing = await this.aiBookComposer.composeChapterFraming(
        userId,
        chapter.title,
        chapter.entries.map((entry) => ({ date: entry.date, content: inlineImagesToAltText(entry.content) })),
      );
      chapter.introduction = framing.introduction;
      chapter.summary = framing.summary;
    }
  }

  async export(
    userId: number,
    query: BookQueryDto,
    coverImage?: Express.Multer.File,
  ): Promise<BookFile> {
    const { book, source } = await this.buildSourcedBook(userId, query);
    book.cover = createBookCover(query.coverTheme, coverImage);
    if (query.narrative !== false) {
      await this.composeNarratives(userId, book, query.weavingMode ?? 'strict');
    }
    if (query.chapterFraming === true) {
      await this.composeChapterFraming(userId, book);
    }
    if (query.embedImages === true) {
      await hydrateBookImages(book, (storedFilename, maxBytes) => this.attachmentsService.getFileBuffer(storedFilename, maxBytes), this.logger);
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
        try {
          content = await renderBookPdf(book, renderOptions);
        } catch (error) {
          if (coverImage) {
            throw apiError(BadRequestException, 'BOOK_COVER_INVALID', 'Cover image could not be decoded.');
          }
          throw error;
        }
        extension = 'pdf';
        contentType = 'application/pdf';
        break;
    }

    return {
      content,
      filename: `thoughty_book_${titleLabel}_${dateStr}.${extension}`,
      contentType,
      title: book.title,
      author: book.author,
      sourceManifest: {
        chapters: book.chapters.map((chapter) => ({
          title: chapter.title,
          entryIds: chapter.entries
            .map((entry) => entry.id)
            .filter((id): id is number => typeof id === 'number'),
        })),
      },
      source,
    };
  }
}
