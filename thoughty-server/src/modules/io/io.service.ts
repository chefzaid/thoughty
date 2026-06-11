import { Injectable, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, Setting, Diary, User } from '@/database/entities';
import {
  DEFAULT_FORMAT,
  validateFormatConfig,
  generateTextFile,
  generateJsonFile,
  generateMarkdownFile,
  parseTextFile,
  parseJsonFile,
  parseMarkdownFile,
  findDuplicates,
  buildJournalDocument,
  renderBookPdf,
  renderBookHtml,
  renderBookEpub,
  FormatConfig,
  ParsedEntry,
} from '@/common/utils';
import { FormatConfigDto, PreviewImportDto, ImportDto, PreviewResponseDto, ImportResponseDto } from './dto';

const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ENTRIES_PER_IMPORT = 10000;

export type TextExportFormat = 'txt' | 'json' | 'md';
export type ExportFormat = TextExportFormat | 'pdf' | 'html' | 'epub';

export interface ExportFile {
  content: string | Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class IoService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getFormatConfig(userId: number): Promise<FormatConfig> {
    const settings = await this.settingRepository.find({
      where: { userId },
    });

    const formatConfig: Partial<FormatConfig> = { ...DEFAULT_FORMAT };
    for (const setting of settings) {
      if (setting.key.startsWith('io_')) {
        const key = setting.key.replace('io_', '') as keyof FormatConfig;
        (formatConfig as Record<string, string>)[key] = setting.value;
      }
    }

    return validateFormatConfig(formatConfig);
  }

  private async getTargetDiaryId(userId: number, providedDiaryId?: number): Promise<number | undefined> {
    if (providedDiaryId) {
      return providedDiaryId;
    }

    const defaultDiary = await this.diaryRepository.findOne({
      where: { userId, isDefault: true },
    });

    return defaultDiary?.id;
  }

  private validateImportContent(content: string): void {
    if (!content) {
      throw new BadRequestException('File content is required');
    }
    if (typeof content !== 'string') {
      throw new BadRequestException('Content must be a string');
    }
    if (content.length > MAX_IMPORT_SIZE) {
      throw new PayloadTooLargeException(
        `File too large. Maximum size is ${MAX_IMPORT_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  private async buildDiaryNameMap(
    userId: number,
    parsedEntries: ParsedEntry[],
    diaryId?: number,
  ): Promise<Map<string, number> | undefined> {
    if (diaryId || !parsedEntries.some((entry) => entry.diaryName)) {
      return undefined;
    }

    const diaries = await this.diaryRepository.find({ where: { userId } });
    return new Map(diaries.map((diary) => [diary.name.toLowerCase(), diary.id]));
  }

  private async buildDuplicatesToSkip(
    userId: number,
    parsedEntries: ParsedEntry[],
    skipDuplicates: boolean,
    diaryId?: number,
  ): Promise<Set<number>> {
    const duplicatesToSkip = new Set<number>();
    if (!skipDuplicates) {
      return duplicatesToSkip;
    }

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId });

    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const existingEntries = await qb.getMany();
    const duplicates = findDuplicates(parsedEntries, existingEntries);

    for (const duplicate of duplicates) {
      const index = parsedEntries.indexOf(duplicate.imported);
      if (index !== -1) {
        duplicatesToSkip.add(index);
      }
    }

    return duplicatesToSkip;
  }

  private async getDefaultVisibility(
    userId: number,
    diaryId?: number,
  ): Promise<'public' | 'private'> {
    if (!diaryId) {
      return 'private';
    }

    const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
    return diary?.visibility ?? 'private';
  }

  private resolveEntryDiaryId(
    entry: ParsedEntry,
    targetDiaryId?: number,
    diaryNameMap?: Map<string, number>,
  ): number | undefined {
    if (!diaryNameMap || !entry.diaryName) {
      return targetDiaryId;
    }

    return diaryNameMap.get(entry.diaryName.toLowerCase()) ?? targetDiaryId;
  }

  private async saveImportedEntry(
    userId: number,
    entry: ParsedEntry,
    defaultVisibility: 'public' | 'private',
    diaryId?: number,
  ): Promise<void> {
    const countResult = await this.entryRepository.count({
      where: { userId, date: entry.date },
    });
    const nextIndex = countResult + 1;

    await this.entryRepository.save({
      userId,
      date: entry.date,
      index: nextIndex,
      tags: entry.tags,
      content: entry.content,
      format: entry.format || 'plain',
      visibility: entry.visibility || defaultVisibility,
      diaryId,
    });
  }

  async getFormat(userId: number): Promise<FormatConfig> {
    return this.getFormatConfig(userId);
  }

  async saveFormat(userId: number, dto: FormatConfigDto): Promise<{ success: boolean; config: FormatConfig }> {
    const config = validateFormatConfig(dto);

    for (const [key, value] of Object.entries(config)) {
      const serializedValue =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

      await this.settingRepository.upsert(
        {
          userId,
          key: `io_${key}`,
          value: serializedValue,
        },
        ['userId', 'key'],
      );
    }

    return { success: true, config };
  }

  private async renderExportDocument(
    userId: number,
    entries: Entry[],
    format: 'pdf' | 'html' | 'epub',
    diary: Diary | null,
  ): Promise<{ content: string | Buffer; extension: string; contentType: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const document = buildJournalDocument(entries, {
      title: diary?.name ?? 'My Journal',
      author: user?.username,
    });

    switch (format) {
      case 'html':
        return {
          content: renderBookHtml(document),
          extension: 'html',
          contentType: 'text/html; charset=utf-8',
        };
      case 'epub':
        return {
          content: await renderBookEpub(document),
          extension: 'epub',
          contentType: 'application/epub+zip',
        };
      default:
        return {
          content: await renderBookPdf(document),
          extension: 'pdf',
          contentType: 'application/pdf',
        };
    }
  }

  async export(userId: number, diaryId?: number, includeVisibility?: boolean, format: ExportFormat = 'txt'): Promise<ExportFile> {
    const diary = diaryId
      ? await this.diaryRepository.findOne({ where: { id: diaryId, userId } })
      : null;

    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC');

    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }

    const entries = await qb.getMany();

    // When exporting all diaries, attach diary names to entries
    let entriesWithDiary = entries as Array<Entry & { diaryName?: string }>;
    if (!diaryId) {
      const diaries = await this.diaryRepository.find({ where: { userId } });
      const diaryMap = new Map(diaries.map((d) => [d.id, d.name]));
      entriesWithDiary = entries.map((e) => ({
        ...e,
        diaryName: e.diaryId ? diaryMap.get(e.diaryId) : undefined,
      }));
    }

    let fileContent: string | Buffer;
    let extension: string;
    let contentType: string;

    switch (format) {
      case 'json':
        fileContent = generateJsonFile(entriesWithDiary, includeVisibility);
        extension = 'json';
        contentType = 'application/json; charset=utf-8';
        break;
      case 'md':
        fileContent = generateMarkdownFile(entriesWithDiary, includeVisibility);
        extension = 'md';
        contentType = 'text/markdown; charset=utf-8';
        break;
      case 'pdf':
      case 'html':
      case 'epub': {
        const document = await this.renderExportDocument(userId, entries, format, diary);
        fileContent = document.content;
        extension = document.extension;
        contentType = document.contentType;
        break;
      }
      default: {
        const formatConfig = await this.getFormatConfig(userId);
        fileContent = generateTextFile(entriesWithDiary, formatConfig, includeVisibility);
        extension = 'txt';
        contentType = 'text/plain; charset=utf-8';
        break;
      }
    }

    let diaryLabel = 'all_diaries';
    if (diaryId) {
      diaryLabel = diary ? diary.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_') : `diary${diaryId}`;
    }
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `thoughty_${diaryLabel}_${dateStr}.${extension}`;

    return { content: fileContent, filename, contentType };
  }

  private parseContent(content: string, formatConfig: FormatConfig) {
    // Try JSON first
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseJsonFile(content);
      } catch {
        // Not valid JSON, fall through
      }
    }
    // Try Markdown (starts with # YYYY-MM-DD)
    if (/^#\s+\d{4}-\d{2}-\d{2}/m.test(trimmed)) {
      return parseMarkdownFile(content);
    }
    // Default to text format
    return parseTextFile(content, formatConfig);
  }

  async preview(userId: number, dto: PreviewImportDto): Promise<PreviewResponseDto> {
    this.validateImportContent(dto.content);

    const formatConfig = await this.getFormatConfig(userId);
    const parsedEntries = this.parseContent(dto.content, formatConfig);

    // Get existing entries
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.user_id = :userId', { userId });

    if (dto.diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId: dto.diaryId });
    }

    const existingEntries = await qb.getMany();
    const duplicates = findDuplicates(parsedEntries, existingEntries);

    return {
      entries: parsedEntries,
      totalCount: parsedEntries.length,
      duplicates: duplicates.map((d) => ({
        date: d.imported.date,
        content:
          d.imported.content.substring(0, 100) + (d.imported.content.length > 100 ? '...' : ''),
      })),
      duplicateCount: duplicates.length,
    };
  }

  async import(userId: number, dto: ImportDto): Promise<ImportResponseDto> {
    this.validateImportContent(dto.content);

    const formatConfig = await this.getFormatConfig(userId);
    const parsedEntries = this.parseContent(dto.content, formatConfig);

    if (parsedEntries.length > MAX_ENTRIES_PER_IMPORT) {
      throw new BadRequestException(
        `Too many entries. Maximum ${MAX_ENTRIES_PER_IMPORT} entries per import. Found ${parsedEntries.length}.`,
      );
    }

    const skipDuplicates = dto.skipDuplicates !== false;
    const targetDiaryId = await this.getTargetDiaryId(userId, dto.diaryId);
    const [diaryNameMap, duplicatesToSkip, defaultVisibility] = await Promise.all([
      this.buildDiaryNameMap(userId, parsedEntries, dto.diaryId),
      this.buildDuplicatesToSkip(userId, parsedEntries, skipDuplicates, dto.diaryId),
      this.getDefaultVisibility(userId, targetDiaryId),
    ]);

    let importedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < parsedEntries.length; i++) {
      if (duplicatesToSkip.has(i)) {
        skippedCount++;
        continue;
      }

      const entry = parsedEntries[i];
      const entryDiaryId = this.resolveEntryDiaryId(entry, targetDiaryId, diaryNameMap);
      await this.saveImportedEntry(userId, entry, defaultVisibility, entryDiaryId);

      importedCount++;
    }

    return {
      success: true,
      importedCount,
      skippedCount,
      totalProcessed: parsedEntries.length,
    };
  }
}
