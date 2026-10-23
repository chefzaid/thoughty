import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Attachment, Diary, Entry } from '@/database/entities';
import { normalizeEntryTitle, normalizeMood, normalizeTimeOfDay, sanitizeString } from '@/common/utils';
import { AttachmentsService } from '@/modules/attachments';
import { DiariesService } from '@/modules/diaries';
import {
  AppImportDto,
  AppImportEntryDto,
  AppImportResponseDto,
  AppImportedEntryDto,
  ImportAttachmentsResponseDto,
} from './dto';

function journalKey(name: string): string {
  return name.trim().toLowerCase();
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => sanitizeString(tag.trim()).substring(0, 50)).filter(Boolean))];
}

/**
 * Brings in entries parsed in the browser from another journaling app's export,
 * then the photos and recordings that go with them. Each entry keeps its source
 * ID, so an interrupted import can simply be run again.
 */
@Injectable()
export class AppImportService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly diariesService: DiariesService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async importEntries(userId: number, dto: AppImportDto): Promise<AppImportResponseDto> {
    const fallbackDiaryId = await this.resolveDiaryId(userId, dto.diaryId);
    const journals = dto.journalsAsDiaries
      ? await this.resolveJournalDiaries(userId, dto.entries)
      : { ids: new Map<string, number>(), created: [] };

    const refOf = (entry: AppImportEntryDto) => `${dto.source}:${entry.sourceId}`;
    const existing = await this.entryRepository.find({
      select: { id: true, importRef: true },
      where: { userId, importRef: In(dto.entries.map(refOf)) },
    });
    const entryIdByRef = new Map(existing.map((entry) => [entry.importRef as string, entry.id]));
    const attachedFiles = await this.attachedFileNames(userId, existing.map((entry) => entry.id));

    const pending = new Map<string, AppImportEntryDto>();
    for (const entry of dto.entries) {
      if (!entryIdByRef.has(refOf(entry))) {
        pending.set(refOf(entry), entry);
      }
    }

    const nextIndex = await this.countEntriesByDate(userId, [...pending.values()].map((entry) => entry.date));
    const rows = [...pending.entries()].map(([importRef, entry]) => {
      const index = (nextIndex.get(entry.date) ?? 0) + 1;
      nextIndex.set(entry.date, index);
      return this.entryRepository.create({
        userId,
        diaryId: (entry.journal && journals.ids.get(journalKey(entry.journal))) || fallbackDiaryId || null,
        date: entry.date,
        index,
        title: normalizeEntryTitle(entry.title),
        timeOfDay: normalizeTimeOfDay(entry.timeOfDay),
        mood: normalizeMood(entry.mood),
        tags: cleanTags(entry.tags),
        content: entry.content,
        format: 'markdown',
        visibility: 'private',
        isFavorite: entry.favorite === true,
        importRef,
      });
    });

    if (rows.length > 0) {
      try {
        const saved = await this.entryRepository.save(rows);
        for (const entry of saved) {
          entryIdByRef.set(entry.importRef as string, entry.id);
        }
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException('These entries are already being imported');
        }
        throw error;
      }
    }

    const entries: AppImportedEntryDto[] = dto.entries.map((entry) => {
      const entryId = entryIdByRef.get(refOf(entry)) as number;
      return {
        sourceId: entry.sourceId,
        entryId,
        alreadyImported: !pending.has(refOf(entry)),
        attachedFiles: attachedFiles.get(entryId) ?? [],
      };
    });

    return {
      entries,
      importedCount: rows.length,
      alreadyImportedCount: dto.entries.length - rows.length,
      createdDiaries: journals.created,
    };
  }

  /** Stores each file on the entry named at the same position in `entryIds`. */
  async attachFiles(
    userId: number,
    files: Express.Multer.File[] | undefined,
    entryIdsField: string,
  ): Promise<ImportAttachmentsResponseDto> {
    const entryIds = entryIdsField.split(',').map(Number);
    if (!files?.length || files.length !== entryIds.length) {
      throw new BadRequestException('Send one entry ID for each file');
    }

    const uniqueIds = [...new Set(entryIds)];
    const owned = await this.entryRepository.count({ where: { userId, id: In(uniqueIds) } });
    if (owned !== uniqueIds.length) {
      throw new NotFoundException('Entry not found');
    }
    for (const file of files) {
      this.attachmentsService.assertUploadable(file);
    }

    const attachments: ImportAttachmentsResponseDto['attachments'] = [];
    for (const [position, file] of files.entries()) {
      const attachment = await this.attachmentsService.upload(userId, file, entryIds[position]);
      attachments.push({
        id: attachment.id,
        entryId: entryIds[position],
        originalFilename: attachment.originalFilename,
      });
    }
    return { attachments };
  }

  private async resolveDiaryId(userId: number, diaryId?: number): Promise<number | undefined> {
    const diary = await this.diaryRepository.findOne({
      where: diaryId ? { id: diaryId, userId } : { userId, isDefault: true },
    });
    if (diaryId && !diary) {
      throw new NotFoundException('Diary not found');
    }
    return diary?.id;
  }

  /** Matches journals to diaries by name, ignoring case, and creates private diaries for the rest. */
  private async resolveJournalDiaries(
    userId: number,
    entries: AppImportEntryDto[],
  ): Promise<{ ids: Map<string, number>; created: string[] }> {
    const journalNames = new Map<string, string>();
    for (const entry of entries) {
      const name = entry.journal?.trim();
      if (name && !journalNames.has(journalKey(name))) {
        journalNames.set(journalKey(name), name);
      }
    }

    const ids = new Map<string, number>();
    const created: string[] = [];
    if (journalNames.size === 0) {
      return { ids, created };
    }

    const loadDiaries = async () => {
      for (const diary of await this.diaryRepository.find({ where: { userId } })) {
        ids.set(journalKey(diary.name), diary.id);
      }
    };
    await loadDiaries();

    for (const [key, name] of journalNames) {
      if (ids.has(key)) {
        continue;
      }
      try {
        const diary = await this.diariesService.create(userId, { name, visibility: 'private' });
        ids.set(key, diary.id);
        created.push(diary.name);
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }
        // A parallel request created it first
        await loadDiaries();
      }
    }
    return { ids, created };
  }

  private async attachedFileNames(userId: number, entryIds: number[]): Promise<Map<number, string[]>> {
    const names = new Map<number, string[]>();
    if (entryIds.length === 0) {
      return names;
    }

    const attachments = await this.attachmentRepository.find({
      select: { entryId: true, originalFilename: true },
      where: { userId, entryId: In(entryIds) },
    });
    for (const attachment of attachments) {
      const entryId = attachment.entryId as number;
      names.set(entryId, [...(names.get(entryId) ?? []), attachment.originalFilename]);
    }
    return names;
  }

  /** Entries already on each day, so imported ones are numbered after them. */
  private async countEntriesByDate(userId: number, dates: string[]): Promise<Map<string, number>> {
    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) {
      return new Map();
    }

    const rows: Array<{ date: string; count: string }> = await this.entryRepository
      .createQueryBuilder('e')
      .select(`to_char(e.date, 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date IN (:...dates)', { dates: uniqueDates })
      .groupBy('e.date')
      .getRawMany();
    return new Map(rows.map((row) => [row.date, Number(row.count)]));
  }
}
