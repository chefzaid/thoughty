import { Injectable, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, Setting, Diary } from '@/database/entities';
import {
  DEFAULT_FORMAT,
  validateFormatConfig,
  generateTextFile,
  parseTextFile,
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

  async export(userId: number, diaryId?: number): Promise<{ content: string; filename: string }> {
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
    const textContent = generateTextFile(entries, formatConfig);

    const diaryLabel = diaryId ? `diary${diaryId}_` : '';
    const filename = `thoughty_${diaryLabel}export_${new Date().toISOString().split('T')[0]}.txt`;

    return { content: textContent, filename };
  }

  async preview(userId: number, dto: PreviewImportDto): Promise<PreviewResponseDto> {
    this.validateImportContent(dto.content);

    const formatConfig = await this.getFormatConfig(userId);
    const parsedEntries = parseTextFile(dto.content, formatConfig);

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
    const parsedEntries = parseTextFile(dto.content, formatConfig);

    if (parsedEntries.length > MAX_ENTRIES_PER_IMPORT) {
      throw new BadRequestException(
        `Too many entries. Maximum ${MAX_ENTRIES_PER_IMPORT} entries per import. Found ${parsedEntries.length}.`,
      );
    }

    const skipDuplicates = dto.skipDuplicates !== false;
    const targetDiaryId = await this.getTargetDiaryId(userId, dto.diaryId);

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

      await this.entryRepository.save({
        userId,
        date: entry.date,
        index: nextIndex,
        tags: entry.tags,
        content: entry.content,
        visibility: 'private',
        diaryId: targetDiaryId,
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
