import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Setting } from '@/database/entities';

export const OPENROUTER_API_KEY_SETTING = 'openRouterApiKey';
export const SENSITIVE_CONFIG_KEYS = new Set([OPENROUTER_API_KEY_SETTING]);

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

    const config = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      if (SENSITIVE_CONFIG_KEYS.has(setting.key)) continue;
      config[setting.key] = setting.value;
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

  async updateConfig(
    userId: number,
    newConfig: Record<string, string>,
  ): Promise<{ success: boolean }> {
    for (const [key, value] of Object.entries(newConfig)) {
      if (SENSITIVE_CONFIG_KEYS.has(key)) continue;
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
