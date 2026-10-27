import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary, Entry } from '@/database/entities';
import {
  ArchivePathAllocator,
  archiveUnfiledFolderName,
  renderArchiveEntry,
  renderArchiveReadme,
  safeArchiveName,
  splitExtension,
  ZipWriter,
  type ArchiveLanguage,
  type ArchiveLink,
  type ZipSink,
} from '@/common/utils';
import { AttachmentsService } from '@/modules/attachments';
import { ConfigService } from '@/modules/config';
import { TimeCapsuleService } from '@/modules/time-capsules/time-capsules.service';

// Uploads are capped at 5 MB; the check guards against objects replaced in storage
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export interface MarkdownArchive {
  filename: string;
  /** Streams the archive into `sink`, one entry and one attachment at a time. */
  write(sink: ZipSink): Promise<void>;
}

function entryDate(date: string | Date): string {
  return typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

/** Full export as a folder of Markdown files, one per entry, with the attachments beside them. */
@Injectable()
export class MarkdownArchiveService {
  private readonly logger = new Logger(MarkdownArchiveService.name);

  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
    private readonly timeCapsules: TimeCapsuleService,
  ) {}

  /** Checks the diary and loads the entries before anything is sent, so errors still get a status code. */
  async prepare(userId: number, diaryId?: number): Promise<MarkdownArchive> {
    const diaries = await this.diaryRepository.find({ where: { userId }, order: { position: 'ASC', id: 'ASC' } });
    const diary = diaryId ? diaries.find((candidate) => candidate.id === diaryId) : undefined;
    if (diaryId && !diary) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }

    const query = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.attachments', 'a')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.index', 'ASC')
      .addOrderBy('a.created_at', 'ASC');
    if (diaryId) {
      query.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    // Sealed time capsules are written as they were sealed, marked `sealed_until`, so the archive is complete
    const [entries, config] = await Promise.all([
      query.getMany().then((loaded) => this.timeCapsules.reveal(loaded)),
      this.configService.getConfig(userId),
    ]);
    const language: ArchiveLanguage = config.language === 'fr' ? 'fr' : 'en';
    const exportedOn = new Date().toISOString().slice(0, 10);
    const label = diary ? diary.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_') : 'all_diaries';

    return {
      filename: `thoughty_${label}_${exportedOn}.zip`,
      write: (sink) => this.write(sink, entries, diaries, language, exportedOn),
    };
  }

  private async write(
    sink: ZipSink,
    entries: Entry[],
    diaries: Diary[],
    language: ArchiveLanguage,
    exportedOn: string,
  ): Promise<void> {
    const zip = new ZipWriter(sink);
    const paths = new ArchivePathAllocator();
    const diaryNames = new Map(diaries.map((diary) => [diary.id, diary.name]));
    const folders = new Map<number | null, string>();
    const folderFor = (diaryId: number | null): string => {
      let folder = folders.get(diaryId);
      if (!folder) {
        const name = diaryId === null ? undefined : diaryNames.get(diaryId);
        folder = paths.allocate(name ? safeArchiveName(name, `diary-${diaryId}`) : archiveUnfiledFolderName(language));
        folders.set(diaryId, folder);
      }
      return folder;
    };

    const diaryCount = new Set(entries.map((entry) => entry.diaryId)).size;
    paths.allocate('README', '.md');
    await zip.addFile('README.md', renderArchiveReadme(language, entries.length, diaryCount, exportedOn));

    for (const entry of entries) {
      const date = entryDate(entry.date);
      const yearFolder = `${folderFor(entry.diaryId)}/${date.slice(0, 4)}`;
      const fileName = entry.title ? `${date} ${safeArchiveName(entry.title, '')}`.trim() : date;
      const markdownPath = paths.allocate(`${yearFolder}/${fileName}`, '.md');
      const links: ArchiveLink[] = [];

      for (const attachment of entry.attachments ?? []) {
        let data: Buffer;
        try {
          data = await this.attachmentsService.getFileBuffer(attachment.storedFilename, MAX_ATTACHMENT_BYTES);
        } catch (error) {
          this.logger.warn(`Leaving attachment ${attachment.id} out of the archive: ${(error as Error).message}`);
          continue;
        }
        const { stem, extension } = splitExtension(attachment.originalFilename);
        const attachmentPath = paths.allocate(`${yearFolder}/attachments/${date}-${safeArchiveName(stem, 'file')}`, extension);
        await zip.addFile(attachmentPath, data, { compress: false });
        links.push({
          path: attachmentPath.slice(yearFolder.length + 1),
          name: attachment.originalFilename,
          mimetype: attachment.mimetype,
          transcript: attachment.transcript,
        });
      }

      const diaryName = entry.diaryId === null ? null : (diaryNames.get(entry.diaryId) ?? null);
      await zip.addFile(markdownPath, renderArchiveEntry({ ...entry, date }, diaryName, links));
    }

    await zip.finish();
  }
}
