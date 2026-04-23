import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '@/database/entities';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { IoService, type ExportFormat } from '@/modules/io/io.service';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { OneDriveProvider } from './providers/onedrive.provider';
import { DropboxProvider } from './providers/dropbox.provider';
import type { CloudProvider, CloudFileInfo, CloudTokens } from './providers/cloud-provider.interface';
import type { CloudProviderType, SyncFrequency } from './dto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);
  private readonly encryptionKey: Buffer;
  private readonly providers: Record<CloudProviderType, CloudProvider>;

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly ioService: IoService,
    private readonly googleDriveProvider: GoogleDriveProvider,
    private readonly oneDriveProvider: OneDriveProvider,
    private readonly dropboxProvider: DropboxProvider,
  ) {
    const secret = process.env.CONFIG_ENCRYPTION_SECRET || 'thoughty-default-config-secret-key';
    this.encryptionKey = scryptSync(secret, 'salt', 32);
    this.providers = {
      google_drive: this.googleDriveProvider,
      onedrive: this.oneDriveProvider,
      dropbox: this.dropboxProvider,
    };
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

  private settingKey(provider: CloudProviderType, field: string): string {
    return `cloud_${provider}_${field}`;
  }

  private async getStoredTokens(userId: number, provider: CloudProviderType): Promise<CloudTokens | null> {
    const [accessSetting, refreshSetting, expiresSetting] = await Promise.all([
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'access_token') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'refresh_token') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'expires_at') } }),
    ]);

    if (!accessSetting || !refreshSetting) return null;

    return {
      accessToken: this.decrypt(accessSetting.value),
      refreshToken: this.decrypt(refreshSetting.value),
      expiresAt: expiresSetting ? Number.parseInt(expiresSetting.value, 10) : undefined,
    };
  }

  private async storeTokens(userId: number, provider: CloudProviderType, tokens: CloudTokens): Promise<void> {
    await Promise.all([
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'access_token'), value: this.encrypt(tokens.accessToken) },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'refresh_token'), value: this.encrypt(tokens.refreshToken) },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'expires_at'), value: String(tokens.expiresAt || 0) },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'connected_at'), value: new Date().toISOString() },
        ['userId', 'key'],
      ),
    ]);
  }

  private async clearTokens(userId: number, provider: CloudProviderType): Promise<void> {
    const keys = ['access_token', 'refresh_token', 'expires_at', 'connected_at'];
    for (const field of keys) {
      await this.settingRepository.delete({ userId, key: this.settingKey(provider, field) });
    }
  }

  private async getValidAccessToken(userId: number, provider: CloudProviderType): Promise<string> {
    const tokens = await this.getStoredTokens(userId, provider);
    if (!tokens) {
      throw new BadRequestException(`Not connected to ${provider.replace('_', ' ')}`);
    }

    // If token is not expired, use it
    if (tokens.expiresAt && tokens.expiresAt > Date.now() + 60000) {
      return tokens.accessToken;
    }

    // Refresh the token
    try {
      const newTokens = await this.providers[provider].refreshAccessToken(tokens.refreshToken);
      await this.storeTokens(userId, provider, newTokens);
      return newTokens.accessToken;
    } catch (error) {
      this.logger.error(`Failed to refresh token for ${provider}:`, error);
      await this.clearTokens(userId, provider);
      throw new BadRequestException(`${provider.replace('_', ' ')} connection expired. Please reconnect.`);
    }
  }

  async getAuthUrl(provider: CloudProviderType, redirectUri: string, state: string): Promise<{ url: string }> {
    const providerImpl = this.providers[provider];
    if (!providerImpl) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    return { url: providerImpl.getAuthUrl(redirectUri, state) };
  }

  async connect(userId: number, provider: CloudProviderType, code: string, redirectUri: string): Promise<{ success: boolean; connectedAt: string }> {
    const providerImpl = this.providers[provider];
    if (!providerImpl) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    const tokens = await providerImpl.exchangeCode(code, redirectUri);
    await this.storeTokens(userId, provider, tokens);

    return { success: true, connectedAt: new Date().toISOString() };
  }

  async disconnect(userId: number, provider: CloudProviderType): Promise<{ success: boolean }> {
    await this.clearTokens(userId, provider);
    return { success: true };
  }

  async getStatus(userId: number): Promise<Record<string, { connected: boolean; connectedAt?: string }>> {
    const providers: CloudProviderType[] = ['google_drive', 'onedrive', 'dropbox'];
    const status: Record<string, { connected: boolean; connectedAt?: string }> = {};

    for (const provider of providers) {
      const [tokenSetting, connectedAtSetting] = await Promise.all([
        this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'access_token') } }),
        this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'connected_at') } }),
      ]);

      status[provider] = {
        connected: !!tokenSetting,
        connectedAt: connectedAtSetting?.value,
      };
    }

    return status;
  }

  async listFiles(userId: number, provider: CloudProviderType): Promise<CloudFileInfo[]> {
    const accessToken = await this.getValidAccessToken(userId, provider);
    return this.providers[provider].listFiles(accessToken);
  }

  async uploadExport(
    userId: number,
    provider: CloudProviderType,
    diaryId?: number,
    format: ExportFormat = 'txt',
    includeVisibility?: boolean,
  ): Promise<CloudFileInfo> {
    const accessToken = await this.getValidAccessToken(userId, provider);
    const { content, filename, contentType } = await this.ioService.export(userId, diaryId, includeVisibility, format);
    return this.providers[provider].uploadFile(accessToken, filename, content, contentType);
  }

  async downloadFile(userId: number, provider: CloudProviderType, fileId: string): Promise<{ content: string }> {
    const accessToken = await this.getValidAccessToken(userId, provider);
    const content = await this.providers[provider].downloadFile(accessToken, fileId);
    return { content };
  }

  private readonly frequencyMs: Record<SyncFrequency, number> = {
    every_6h: 6 * 60 * 60 * 1000,
    every_12h: 12 * 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
  };

  async getSyncSchedules(userId: number): Promise<Record<string, {
    enabled: boolean;
    frequency?: SyncFrequency;
    format?: string;
    diaryId?: number;
    includeVisibility?: boolean;
    lastSyncAt?: string;
    lastSyncHash?: string;
    nextSyncAt?: string;
  }>> {
    const providers: CloudProviderType[] = ['google_drive', 'onedrive', 'dropbox'];
    const result: Record<string, {
      enabled: boolean;
      frequency?: SyncFrequency;
      format?: string;
      diaryId?: number;
      includeVisibility?: boolean;
      lastSyncAt?: string;
      lastSyncHash?: string;
      nextSyncAt?: string;
    }> = {};

    for (const provider of providers) {
      const fields = ['sync_enabled', 'sync_frequency', 'sync_format', 'sync_diary_id', 'sync_include_visibility', 'last_sync_at', 'last_sync_hash'];
      const settings = await Promise.all(
        fields.map(field => this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, field) } })),
      );

      const [enabled, frequency, format, diaryId, includeVisibility, lastSyncAt, lastSyncHash] = settings;
      const isEnabled = enabled?.value === 'true';

      let nextSyncAt: string | undefined;
      if (isEnabled && frequency?.value && lastSyncAt?.value) {
        const intervalMs = this.frequencyMs[frequency.value as SyncFrequency];
        if (intervalMs) {
          const lastTime = new Date(lastSyncAt.value).getTime();
          nextSyncAt = new Date(lastTime + intervalMs).toISOString();
        }
      }

      result[provider] = {
        enabled: isEnabled,
        frequency: frequency?.value as SyncFrequency | undefined,
        format: format?.value,
        diaryId: diaryId?.value ? Number.parseInt(diaryId.value, 10) : undefined,
        includeVisibility: includeVisibility?.value === 'true',
        lastSyncAt: lastSyncAt?.value,
        lastSyncHash: lastSyncHash?.value,
        nextSyncAt,
      };
    }

    return result;
  }

  async setSyncSchedule(
    userId: number,
    provider: CloudProviderType,
    frequency: SyncFrequency,
    format: ExportFormat = 'txt',
    diaryId?: number,
    includeVisibility?: boolean,
  ): Promise<{ success: boolean }> {
    // Verify the provider is connected
    const tokenSetting = await this.settingRepository.findOne({
      where: { userId, key: this.settingKey(provider, 'access_token') },
    });
    if (!tokenSetting) {
      throw new BadRequestException(`Not connected to ${provider.replace('_', ' ')}. Connect first before setting up a schedule.`);
    }

    await Promise.all([
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'sync_enabled'), value: 'true' },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'sync_frequency'), value: frequency },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'sync_format'), value: format },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'sync_diary_id'), value: diaryId ? String(diaryId) : '' },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'sync_include_visibility'), value: includeVisibility ? 'true' : 'false' },
        ['userId', 'key'],
      ),
    ]);

    return { success: true };
  }

  async deleteSyncSchedule(userId: number, provider: CloudProviderType): Promise<{ success: boolean }> {
    const fields = ['sync_enabled', 'sync_frequency', 'sync_format', 'sync_diary_id', 'sync_include_visibility', 'last_sync_at', 'last_sync_hash'];
    for (const field of fields) {
      await this.settingRepository.delete({ userId, key: this.settingKey(provider, field) });
    }
    return { success: true };
  }

  async executeDiffSync(userId: number, provider: CloudProviderType): Promise<{
    synced: boolean;
    message: string;
    file?: CloudFileInfo;
  }> {
    // Load schedule config
    const [formatSetting, diaryIdSetting, includeVisibilitySetting, lastHashSetting] = await Promise.all([
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'sync_format') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'sync_diary_id') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'sync_include_visibility') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'last_sync_hash') } }),
    ]);

    const format = (formatSetting?.value as ExportFormat) || 'txt';
    const diaryId = diaryIdSetting?.value ? Number.parseInt(diaryIdSetting.value, 10) : undefined;
    const includeVisibility = includeVisibilitySetting?.value === 'true';
    const lastHash = lastHashSetting?.value || '';

    // Generate export content
    const { content, filename, contentType } = await this.ioService.export(userId, diaryId, includeVisibility, format);

    // Compute content hash
    const currentHash = createHash('sha256').update(content).digest('hex');

    // Compare with stored hash
    if (currentHash === lastHash) {
      // Update last_sync_at even when skipping to advance the schedule timer
      await this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'last_sync_at'), value: new Date().toISOString() },
        ['userId', 'key'],
      );
      return { synced: false, message: 'No changes detected since last sync' };
    }

    // Upload to cloud
    const accessToken = await this.getValidAccessToken(userId, provider);
    const file = await this.providers[provider].uploadFile(accessToken, filename, content, contentType);

    // Store new hash and timestamp
    await Promise.all([
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'last_sync_at'), value: new Date().toISOString() },
        ['userId', 'key'],
      ),
      this.settingRepository.upsert(
        { userId, key: this.settingKey(provider, 'last_sync_hash'), value: currentHash },
        ['userId', 'key'],
      ),
    ]);

    return { synced: true, message: 'Sync completed successfully', file };
  }

  async checkSyncDue(userId: number, provider: CloudProviderType): Promise<boolean> {
    const [enabledSetting, frequencySetting, lastSyncAtSetting] = await Promise.all([
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'sync_enabled') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'sync_frequency') } }),
      this.settingRepository.findOne({ where: { userId, key: this.settingKey(provider, 'last_sync_at') } }),
    ]);

    if (enabledSetting?.value !== 'true' || !frequencySetting?.value) return false;

    const intervalMs = this.frequencyMs[frequencySetting.value as SyncFrequency];
    if (!intervalMs) return false;

    // If never synced, it's due
    if (!lastSyncAtSetting?.value) return true;

    const lastSyncTime = new Date(lastSyncAtSetting.value).getTime();
    return Date.now() >= lastSyncTime + intervalMs;
  }
}
