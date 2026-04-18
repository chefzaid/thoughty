import { Injectable, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, Setting, Diary } from '@/database/entities';
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
  FormatConfig,
} from '@/common/utils';
import { FormatConfigDto, PreviewImportDto, ImportDto, PreviewResponseDto, ImportResponseDto } from './dto';

const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ENTRIES_PER_IMPORT = 10000;

@Injectable()
export class IoService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
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

  async getFormat(userId: number): Promise<FormatConfig> {
    return this.getFormatConfig(userId);
  }

  async saveFormat(userId: number, dto: FormatConfigDto): Promise<{ success: boolean; config: FormatConfig }> {
    const config = validateFormatConfig(dto);

    for (const [key, value] of Object.entries(config)) {
      await this.settingRepository.upsert(
        {
          userId,
          key: `io_${key}`,
          value: String(value),
        },
        ['userId', 'key'],
      );
    }

    return { success: true, config };
  }

  async export(userId: number, diaryId?: number, includeVisibility?: boolean, format: 'txt' | 'json' | 'md' = 'txt'): Promise<{ content: string; filename: string; contentType: string }> {
    const formatConfig = await this.getFormatConfig(userId);

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

    let fileContent: string;
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
      default:
        fileContent = generateTextFile(entriesWithDiary, formatConfig, includeVisibility);
        extension = 'txt';
        contentType = 'text/plain; charset=utf-8';
        break;
    }

    let diaryLabel = '';
    if (diaryId) {
      const diary = await this.diaryRepository.findOne({ where: { id: diaryId, userId } });
      diaryLabel = diary ? diary.name.replace(/[^a-zA-Z0-9_-]/g, '_') : `diary${diaryId}`;
    } else {
      diaryLabel = 'all_diaries';
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

    // Build diary name -> id map for entries with diary names
    let diaryNameMap: Map<string, number> | undefined;
    if (!dto.diaryId) {
      const hasDiaryNames = parsedEntries.some((e) => e.diaryName);
      if (hasDiaryNames) {
        const diaries = await this.diaryRepository.find({ where: { userId } });
        diaryNameMap = new Map(diaries.map((d) => [d.name.toLowerCase(), d.id]));
      }
    }

    // Build duplicate skip set
    const duplicatesToSkip = new Set<number>();
    if (skipDuplicates) {
      const qb = this.entryRepository
        .createQueryBuilder('e')
        .where('e.user_id = :userId', { userId });

      if (dto.diaryId) {
        qb.andWhere('e.diary_id = :diaryId', { diaryId: dto.diaryId });
      }

      const existingEntries = await qb.getMany();
      const duplicates = findDuplicates(parsedEntries, existingEntries);

      for (const dup of duplicates) {
        const index = parsedEntries.indexOf(dup.imported);
        if (index !== -1) {
          duplicatesToSkip.add(index);
        }
      }
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Get diary's default visibility
    let defaultVisibility: 'public' | 'private' = 'private';
    if (targetDiaryId) {
      const diary = await this.diaryRepository.findOne({ where: { id: targetDiaryId, userId } });
      if (diary?.visibility) {
        defaultVisibility = diary.visibility;
      }
    }

    for (let i = 0; i < parsedEntries.length; i++) {
      if (duplicatesToSkip.has(i)) {
        skippedCount++;
        continue;
      }

      const entry = parsedEntries[i];

      // Calculate index for the day
      const countResult = await this.entryRepository.count({
        where: { userId, date: entry.date },
      });
      const nextIndex = countResult + 1;

      // Resolve diary: use diary name if present, otherwise fall back to target diary
      let entryDiaryId = targetDiaryId;
      if (diaryNameMap && entry.diaryName) {
        const matchedId = diaryNameMap.get(entry.diaryName.toLowerCase());
        if (matchedId) {
          entryDiaryId = matchedId;
        }
      }

      await this.entryRepository.save({
        userId,
        date: entry.date,
        index: nextIndex,
        tags: entry.tags,
        content: entry.content,
        format: entry.format || 'plain',
        visibility: entry.visibility || defaultVisibility,
        diaryId: entryDiaryId,
      });

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
