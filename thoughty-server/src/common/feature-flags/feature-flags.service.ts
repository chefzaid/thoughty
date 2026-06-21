import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  ai: true,
  bookConverter: true,
  cloudSync: true,
  publicSharing: true,
};

interface FeatureFlagProviderResponse {
  flags?: Record<string, unknown>;
}

interface CachedFlags {
  expiresAt: number;
  flags: Record<string, boolean>;
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeFlags(rawFlags: Record<string, unknown> | undefined): Record<string, boolean> {
  const flags: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(rawFlags ?? {})) {
    const parsed = parseBooleanFlag(value);
    if (parsed !== null) {
      flags[key] = parsed;
    }
  }

  return flags;
}

function parseInlineFlags(value?: string): Record<string, boolean> {
  const entries = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

  return normalizeFlags(Object.fromEntries(entries.map((entry) => {
    const [key, flagValue = 'true'] = entry.split('=');
    return [key.trim(), flagValue.trim()];
  })));
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache: CachedFlags | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getFallbackFlags(): Record<string, boolean> {
    return {
      ...DEFAULT_FEATURE_FLAGS,
      ...parseInlineFlags(this.configService.get<string>('FEATURE_FLAGS')),
    };
  }

  private getCacheTtlMs(): number {
    const configured = Number.parseInt(this.configService.get<string>('FEATURE_FLAG_CACHE_TTL_MS') ?? '', 10);
    return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
  }

  private async fetchProviderFlags(providerUrl: string): Promise<Record<string, boolean>> {
    const token = this.configService.get<string>('FEATURE_FLAG_PROVIDER_TOKEN');
    const response = await fetch(providerUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Feature flag provider returned ${response.status}`);
    }

    const payload = (await response.json()) as FeatureFlagProviderResponse | Record<string, unknown>;
    const rawFlags = 'flags' in payload ? payload.flags : payload;
    if (!rawFlags || typeof rawFlags !== 'object' || Array.isArray(rawFlags)) {
      return {};
    }
    return normalizeFlags(rawFlags as Record<string, unknown>);
  }

  async getFeatureFlags(): Promise<Record<string, boolean>> {
    const fallbackFlags = this.getFallbackFlags();
    const providerUrl = this.configService.get<string>('FEATURE_FLAG_PROVIDER_URL')?.trim();

    if (!providerUrl) {
      return fallbackFlags;
    }

    if (this.cache && this.cache.expiresAt > Date.now()) {
      return { ...fallbackFlags, ...this.cache.flags };
    }

    try {
      const providerFlags = await this.fetchProviderFlags(providerUrl);
      this.cache = {
        flags: providerFlags,
        expiresAt: Date.now() + this.getCacheTtlMs(),
      };
      return { ...fallbackFlags, ...providerFlags };
    } catch (error) {
      this.logger.warn('Feature flag provider unavailable', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown feature flag provider error',
      });
      return this.cache ? { ...fallbackFlags, ...this.cache.flags } : fallbackFlags;
    }
  }
}
