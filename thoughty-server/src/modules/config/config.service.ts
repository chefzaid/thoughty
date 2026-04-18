import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, User, Diary, Entry, EntryRevision, Attachment } from '@/database/entities';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const DEFAULT_SETTINGS: Record<string, string> = {
  theme: 'dark',
  name: 'User',
  entriesPerPage: '10',
  defaultVisibility: 'private',
  language: 'en',
  autoTagMaxTags: '0',
};

const SENSITIVE_KEYS = new Set(['openRouterApiKey']);
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class ConfigService {
  private readonly encryptionKey: Buffer;

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
  ) {
    const secret = process.env.CONFIG_ENCRYPTION_SECRET || 'thoughty-default-config-secret-key';
    this.encryptionKey = scryptSync(secret, 'salt', 32);
  }

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return '';
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch {
      return '';
    }
  }

  private maskApiKey(key: string): string {
    if (key.length <= 4) return '****';
    return '*'.repeat(key.length - 4) + key.slice(-4);
  }

  async getConfig(userId: number): Promise<Record<string, string>> {
    const settings = await this.settingRepository.find({
      where: { userId },
    });

    const config = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      if (SENSITIVE_KEYS.has(setting.key)) {
        const decrypted = this.decrypt(setting.value);
        config[setting.key] = decrypted ? this.maskApiKey(decrypted) : '';
      } else {
        config[setting.key] = setting.value;
      }
    }

    return config;
  }

  async getDecryptedConfig(userId: number, key: string): Promise<string> {
    const setting = await this.settingRepository.findOne({
      where: { userId, key },
    });
    if (!setting) return '';
    if (SENSITIVE_KEYS.has(key)) {
      return this.decrypt(setting.value);
    }
    return setting.value;
  }

  async updateConfig(userId: number, newConfig: Record<string, string>): Promise<{ success: boolean }> {
    for (const [key, value] of Object.entries(newConfig)) {
      // Skip masked values (user didn't change the API key)
      if (SENSITIVE_KEYS.has(key) && value.startsWith('*')) {
        continue;
      }

      const storedValue = SENSITIVE_KEYS.has(key) && value ? this.encrypt(value) : String(value);

      await this.settingRepository.upsert(
        {
          userId,
          key,
          value: storedValue,
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

    const safeSettings = settings
      .filter((s) => !SENSITIVE_KEYS.has(s.key))
      .map((s) => ({ key: s.key, value: s.value, updatedAt: s.updatedAt }));

    return {
      exportedAt: new Date().toISOString(),
      user: safeUser,
      diaries: diaries.map((d) => ({
        id: d.id,
        name: d.name,
        icon: d.icon,
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
