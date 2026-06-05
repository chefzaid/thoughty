import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment, Diary, Entry, EntryRevision, Setting, User } from '@/database/entities';

@Injectable()
export class UserDataExportService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(EntryRevision)
    private readonly revisionRepository: Repository<EntryRevision>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  async downloadData(userId: number): Promise<Record<string, unknown>> {
    const [user, diaries, entries, revisions, attachments, settings] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.diaryRepository.find({ where: { userId }, order: { position: 'ASC' } }),
      this.entryRepository.find({ where: { userId }, order: { date: 'ASC', index: 'ASC' } }),
      this.revisionRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.attachmentRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.settingRepository.find({ where: { userId } }),
    ]);

    const safeUser = user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
          authProvider: user.authProvider,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      : null;

    const safeSettings = settings.map((setting) => ({
      key: setting.key,
      value: setting.value,
      updatedAt: setting.updatedAt,
    }));

    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      diaries: diaries.map((diary) => ({
        id: diary.id,
        name: diary.name,
        icon: diary.icon,
        color: diary.color,
        visibility: diary.visibility,
        isDefault: diary.isDefault,
        position: diary.position,
        createdAt: diary.createdAt,
      })),
      entries: entries.map((entry) => ({
        id: entry.id,
        diaryId: entry.diaryId,
        date: entry.date,
        index: entry.index,
        content: entry.content,
        tags: entry.tags,
        format: entry.format,
        visibility: entry.visibility,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
      })),
      revisions: revisions.map((revision) => ({
        id: revision.id,
        entryId: revision.entryId,
        content: revision.content,
        tags: revision.tags,
        date: revision.date,
        format: revision.format,
        visibility: revision.visibility,
        createdAt: revision.createdAt,
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        entryId: attachment.entryId,
        originalFilename: attachment.originalFilename,
        mimetype: attachment.mimetype,
        size: attachment.size,
        createdAt: attachment.createdAt,
      })),
      settings: safeSettings,
    };
  }
}