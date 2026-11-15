import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../errors/api-error';

/**
 * The features a flag can switch off without a redeploy, each on unless the provider or `FEATURE_FLAGS`
 * says otherwise. docs/architecture.md, "Feature flags", lists what each one covers.
 */
export const DEFAULT_FEATURE_FLAGS = {
  ai: true,
  bookConverter: true,
  cloudSync: true,
  publicSharing: true,
} as const satisfies Record<string, boolean>;

export type FeatureFlag = keyof typeof DEFAULT_FEATURE_FLAGS;

/** How long a provider request may take before the last known flags (or the defaults) are used. */
export const FEATURE_FLAG_PROVIDER_TIMEOUT_MS = 3_000;

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

/**
 * The runtime feature flags: the defaults, overridden by `FEATURE_FLAGS` (read on every call), overridden
 * by the provider at `FEATURE_FLAG_PROVIDER_URL` when one is set. The provider's answer is kept for
 * `FEATURE_FLAG_CACHE_TTL_MS` (60 s by default), so a change there applies within that time on every
 * API pod and worker. When the provider fails, the last flags it gave are kept (the defaults before any),
 * and it is asked again after the same delay rather than on every request.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache: CachedFlags | null = null;
  private pending: Promise<Record<string, boolean>> | null = null;

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
      signal: AbortSignal.timeout(FEATURE_FLAG_PROVIDER_TIMEOUT_MS),
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

  /** The provider's flags, asked once at a time and kept for the cache TTL, also after a failure. */
  private async loadProviderFlags(providerUrl: string): Promise<Record<string, boolean>> {
    try {
      const flags = await this.fetchProviderFlags(providerUrl);
      this.cache = { flags, expiresAt: Date.now() + this.getCacheTtlMs() };
    } catch (error) {
      this.logger.warn('Feature flag provider unavailable', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown feature flag provider error',
      });
      this.cache = { flags: this.cache?.flags ?? {}, expiresAt: Date.now() + this.getCacheTtlMs() };
    }
    return this.cache.flags;
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

    this.pending ??= this.loadProviderFlags(providerUrl).finally(() => {
      this.pending = null;
    });
    return { ...fallbackFlags, ...(await this.pending) };
  }

  /** Whether a feature is on right now. */
  async isEnabled(flag: FeatureFlag): Promise<boolean> {
    return (await this.getFeatureFlags())[flag] !== false;
  }

  /** Refuses with `503 FEATURE_DISABLED` while the feature is switched off. */
  async assertEnabled(flag: FeatureFlag): Promise<void> {
    if (!(await this.isEnabled(flag))) {
      throw apiError(ServiceUnavailableException, 'FEATURE_DISABLED', `The ${flag} feature is turned off for now`);
    }
  }
}
