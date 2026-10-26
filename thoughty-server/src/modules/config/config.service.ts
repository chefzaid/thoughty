import { BadRequestException, Injectable } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Setting } from '@/database/entities';
import { UpdateConfigDto, USER_CONFIG_KEYS } from './dto/config.dto';

export const OPENROUTER_API_KEY_SETTING = 'openRouterApiKey';
export const SENSITIVE_CONFIG_KEYS = new Set([OPENROUTER_API_KEY_SETTING]);

/**
 * Cloud sync settings a personal data export may list: whether and when a provider was connected
 * and how syncing is set up. Its tokens, token expiry, and last content hash never leave the server.
 */
const EXPORTABLE_CLOUD_SETTING =
  /^cloud_(google_drive|onedrive|dropbox)_(connected_at|sync_enabled|sync_frequency|sync_format|sync_diary_id|sync_include_visibility|last_sync_at)$/;

/** Settings a personal data export includes: preferences, export format, and cloud sync setup. */
export function isExportableSettingKey(key: string): boolean {
  return USER_CONFIG_KEYS.has(key) || key.startsWith('io_') || EXPORTABLE_CLOUD_SETTING.test(key);
}

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const DEFAULT_SETTINGS: Record<string, string> = {
  theme: 'dark',
  name: 'User',
  fontFamily: 'system',
  fontSize: '16',
  highContrast: 'false',
  entriesPerPage: '10',
  maxPinnedEntries: '3',
  defaultVisibility: 'private',
  language: 'en',
  autoTagMaxTags: '0',
  subscriptionPlan: 'free',
  paymentMethodLabel: '',
};

@Injectable()
export class ConfigService {
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {
    const secret =
      process.env.CONFIG_ENCRYPTION_SECRET ||
      (process.env.NODE_ENV === 'production' ? '' : 'thoughty-development-config-secret');
    if (!secret) {
      throw new Error('CONFIG_ENCRYPTION_SECRET is required in production');
    }
    this.encryptionKey = scryptSync(secret, 'thoughty-config-v1', 32);
  }

  async getConfig(userId: number): Promise<Record<string, string>> {
    const settings = await this.settingRepository.find({
      where: { userId },
    });

    const config: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      // Credentials, cloud tokens, and sync state are internal; only preferences are returned
      if (!USER_CONFIG_KEYS.has(setting.key)) continue;
      config[setting.key] = setting.value;
    }

    // A value stored before preferences were validated falls back to its default, so the web
    // can always send the configuration it was given back unchanged.
    for (const error of validateSync(plainToInstance(UpdateConfigDto, config))) {
      if (error.property in DEFAULT_SETTINGS) {
        config[error.property] = DEFAULT_SETTINGS[error.property];
      } else {
        delete config[error.property];
      }
    }

    return config;
  }

  async getDecryptedConfig(userId: number, key: string): Promise<string> {
    const setting = await this.settingRepository.findOne({
      where: { userId, key },
    });
    if (!setting) return '';
    return SENSITIVE_CONFIG_KEYS.has(key) ? this.decrypt(setting.value) : setting.value;
  }

  async setEncryptedConfig(userId: number, key: string, value: string): Promise<void> {
    if (!SENSITIVE_CONFIG_KEYS.has(key)) {
      throw new Error(`Setting ${key} is not registered as sensitive`);
    }
    await this.settingRepository.upsert({ userId, key, value: this.encrypt(value) }, [
      'userId',
      'key',
    ]);
  }

  async deleteConfig(userId: number, key: string): Promise<void> {
    await this.settingRepository.delete({ userId, key });
  }

  async updateConfig(userId: number, newConfig: UpdateConfigDto): Promise<{ success: boolean }> {
    const entries = Object.entries(newConfig).filter(([, value]) => value !== undefined);
    const reserved = entries.map(([key]) => key).filter((key) => !USER_CONFIG_KEYS.has(key));
    if (reserved.length > 0) {
      throw apiError(BadRequestException, 'SETTINGS_RESERVED', `Settings cannot be changed here: ${reserved.join(', ')}`);
    }

    for (const [key, value] of entries) {
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

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(value: string): string {
    try {
      const [ivHex, authTagHex, encryptedHex] = value.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return '';
      const decipher = createDecipheriv(
        ENCRYPTION_ALGORITHM,
        this.encryptionKey,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return '';
    }
  }
}
