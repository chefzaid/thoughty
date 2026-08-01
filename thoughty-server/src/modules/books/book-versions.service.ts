import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BookVersion, type BookVersionManifest } from '@/database/entities';
import { Repository } from 'typeorm';
import { BookQueryDto, BookVersionResponseDto } from './dto';
import { BooksService, type BookFile, type BookFormat } from './books.service';

const MAX_VERSION_ARTIFACT_SIZE = 50 * 1024 * 1024;

@Injectable()
export class BookVersionsService {
  constructor(
    @InjectRepository(BookVersion)
    private readonly versionRepository: Repository<BookVersion>,
    private readonly booksService: BooksService,
  ) {}

  private scopeKey(diaryId?: number): string {
    return diaryId ? `diary:${diaryId}` : 'all';
  }

  private toResponse(version: BookVersion): BookVersionResponseDto {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      author: version.author ?? undefined,
      format: version.format as BookFormat,
      filename: version.filename,
      chapterCount: version.chapterCount,
      entryCount: version.entryCount,
      addedEntryCount: version.addedEntryCount,
      addedChapterTitles: version.addedChapterTitles,
      createdAt: version.createdAt.toISOString(),
    };
  }

  private versionedFilename(filename: string, versionNumber: number): string {
    const extensionIndex = filename.lastIndexOf('.');
    if (extensionIndex < 0) {
      return `${filename}_v${versionNumber}`;
    }
    return `${filename.slice(0, extensionIndex)}_v${versionNumber}${filename.slice(extensionIndex)}`;
  }

  private artifactBuffer(file: BookFile): Buffer {
    const content = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf8');
    if (content.length > MAX_VERSION_ARTIFACT_SIZE) {
      throw new BadRequestException('Generated book is too large to save as a version.');
    }
    return content;
  }

  private addedEntries(current: BookVersionManifest, previous?: BookVersionManifest): number {
    const previousIds = new Set(previous?.chapters.flatMap((chapter) => chapter.entryIds) ?? []);
    const currentIds = new Set(current.chapters.flatMap((chapter) => chapter.entryIds));
    return [...currentIds].filter((id) => !previousIds.has(id)).length;
  }

  private addedChapters(current: BookVersionManifest, previous?: BookVersionManifest): string[] {
    const previousTitles = new Set(
      previous?.chapters.map((chapter) => chapter.title.toLowerCase()) ?? [],
    );
    return current.chapters
      .map((chapter) => chapter.title)
      .filter((title) => !previousTitles.has(title.toLowerCase()));
  }

  async list(userId: number, diaryId?: number): Promise<BookVersionResponseDto[]> {
    const versions = await this.versionRepository.find({
      where: { userId, scopeKey: this.scopeKey(diaryId) },
      order: { versionNumber: 'DESC' },
    });
    return versions.map((version) => this.toResponse(version));
  }

  async create(
    userId: number,
    query: BookQueryDto,
    coverImage?: Express.Multer.File,
  ): Promise<BookVersionResponseDto> {
    const file = await this.booksService.export(userId, query, coverImage);
    const content = this.artifactBuffer(file);
    const scopeKey = this.scopeKey(query.diaryId);

    return this.versionRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [userId, query.diaryId ?? 0]);
      const repository = manager.getRepository(BookVersion);
      const previous = await repository.findOne({
        where: { userId, scopeKey },
        order: { versionNumber: 'DESC' },
      });
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      const version = repository.create({
        userId,
        diaryId: query.diaryId ?? null,
        scopeKey,
        versionNumber,
        title: file.title,
        author: file.author ?? null,
        format: query.format ?? 'pdf',
        filename: this.versionedFilename(file.filename, versionNumber),
        contentType: file.contentType,
        content,
        manifest: file.sourceManifest,
        chapterCount: file.sourceManifest.chapters.length,
        entryCount: file.sourceManifest.chapters.reduce(
          (total, chapter) => total + chapter.entryIds.length,
          0,
        ),
        addedEntryCount: this.addedEntries(file.sourceManifest, previous?.manifest),
        addedChapterTitles: this.addedChapters(file.sourceManifest, previous?.manifest),
      });
      return this.toResponse(await repository.save(version));
    });
  }

  async download(userId: number, versionId: number): Promise<BookFile> {
    const version = await this.versionRepository
      .createQueryBuilder('version')
      .addSelect('version.content')
      .where('version.id = :versionId', { versionId })
      .andWhere('version.user_id = :userId', { userId })
      .getOne();
    if (!version) {
      throw new NotFoundException('Book version not found');
    }
    return {
      content: version.content,
      filename: version.filename,
      contentType: version.contentType,
      title: version.title,
      author: version.author ?? undefined,
      sourceManifest: version.manifest,
    };
  }
}
