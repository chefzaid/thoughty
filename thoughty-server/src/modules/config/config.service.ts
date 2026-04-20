import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, User, Diary, Entry, EntryRevision, Attachment } from '@/database/entities';

const DEFAULT_SETTINGS: Record<string, string> = {
  theme: 'dark',
  name: 'User',
  entriesPerPage: '10',
  defaultVisibility: 'private',
  language: 'en',
  autoTagMaxTags: '0',
};

@Injectable()
export class ConfigService {
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

  async getConfig(userId: number): Promise<Record<string, string>> {
    const settings = await this.settingRepository.find({
      where: { userId },
    });

    const config = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      config[setting.key] = setting.value;
    }

    return config;
  }

  async getDecryptedConfig(userId: number, key: string): Promise<string> {
    const setting = await this.settingRepository.findOne({
      where: { userId, key },
    });
    if (!setting) return '';
    return setting.value;
  }

  async updateConfig(userId: number, newConfig: Record<string, string>): Promise<{ success: boolean }> {
    for (const [key, value] of Object.entries(newConfig)) {
      await this.settingRepository.upsert(
        {
          userId,
          key,
          value: String(value),
        },
        ['userId', 'key'],
      );
    }

    return { success: true };
  }

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

    const safeSettings = settings.map((s) => ({ key: s.key, value: s.value, updatedAt: s.updatedAt }));

    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      diaries: diaries.map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
        color: d.color,
        visibility: d.visibility,
        isDefault: d.isDefault,
        position: d.position,
        createdAt: d.createdAt,
      })),
      entries: entries.map((e) => ({
        id: e.id,
        diaryId: e.diaryId,
        date: e.date,
        index: e.index,
        content: e.content,
        tags: e.tags,
        format: e.format,
        visibility: e.visibility,
        isFavorite: e.isFavorite,
        createdAt: e.createdAt,
      })),
      revisions: revisions.map((r) => ({
        id: r.id,
        entryId: r.entryId,
        content: r.content,
        tags: r.tags,
        date: r.date,
        format: r.format,
        visibility: r.visibility,
        createdAt: r.createdAt,
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        entryId: a.entryId,
        originalFilename: a.originalFilename,
        mimetype: a.mimetype,
        size: a.size,
        createdAt: a.createdAt,
      })),
      settings: safeSettings,
    };
  }
}
