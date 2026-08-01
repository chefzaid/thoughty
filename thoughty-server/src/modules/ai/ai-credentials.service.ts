import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { OPENROUTER_API_KEY_SETTING } from '@/modules/config/config.service';
import { AiUsageService } from './ai-usage.service';
import type {
  OpenRouterCredentialStatusDto,
  OpenRouterProviderUsageDto,
  OpenRouterUsageDashboardDto,
} from './dto/openrouter-credentials.dto';

interface OpenRouterKeyData {
  label?: unknown;
  usage?: unknown;
  usage_daily?: unknown;
  usage_weekly?: unknown;
  usage_monthly?: unknown;
  limit?: unknown;
  limit_remaining?: unknown;
  limit_reset?: unknown;
  expires_at?: unknown;
}

@Injectable()
export class AiCredentialsService {
  private readonly keyEndpoint = 'https://openrouter.ai/api/v1/key';

  constructor(
    private readonly configService: ConfigService,
    private readonly usageService: AiUsageService,
  ) {}

  async getStatus(userId: number): Promise<OpenRouterCredentialStatusDto> {
    const personalKey = await this.getPersonalKey(userId);
    if (personalKey) {
      return {
        hasPersonalKey: true,
        keyHint: `...${personalKey.slice(-5)}`,
        source: 'personal',
        aiAvailable: true,
      };
    }

    const serverAvailable = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    return {
      hasPersonalKey: false,
      keyHint: null,
      source: serverAvailable ? 'server' : 'none',
      aiAvailable: serverAvailable,
    };
  }

  async save(userId: number, apiKey: string): Promise<OpenRouterCredentialStatusDto> {
    await this.fetchKeyData(apiKey, true);
    await this.configService.setEncryptedConfig(userId, OPENROUTER_API_KEY_SETTING, apiKey);
    return this.getStatus(userId);
  }

  async remove(userId: number): Promise<OpenRouterCredentialStatusDto> {
    await this.configService.deleteConfig(userId, OPENROUTER_API_KEY_SETTING);
    return this.getStatus(userId);
  }

  async getUsage(userId: number): Promise<OpenRouterUsageDashboardDto> {
    const personalKey = await this.getPersonalKey(userId);
    if (!personalKey) {
      throw new BadRequestException('Add a personal OpenRouter API key to view usage');
    }

    const [provider, thoughty] = await Promise.all([
      this.fetchKeyData(personalKey, false),
      this.usageService.getPersonalUsage(userId),
    ]);
    return { provider, thoughty };
  }

  private getPersonalKey(userId: number): Promise<string> {
    return this.configService.getDecryptedConfig(userId, OPENROUTER_API_KEY_SETTING);
  }

  private async fetchKeyData(
    apiKey: string,
    validating: boolean,
  ): Promise<OpenRouterProviderUsageDto> {
    let response: Response;
    try {
      response = await fetch(this.keyEndpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('Could not reach OpenRouter');
    }

    if (!response.ok) {
      if (validating && (response.status === 401 || response.status === 403)) {
        throw new BadRequestException('OpenRouter rejected this API key');
      }
      throw new BadGatewayException('Could not load OpenRouter key usage');
    }

    const payload = (await response.json()) as { data?: OpenRouterKeyData };
    const data = payload.data;
    if (!data || typeof data !== 'object') {
      throw new BadGatewayException('OpenRouter returned invalid key usage data');
    }

    return {
      label: this.readString(data.label),
      usage: this.readNumber(data.usage) ?? 0,
      usageDaily: this.readNumber(data.usage_daily) ?? 0,
      usageWeekly: this.readNumber(data.usage_weekly) ?? 0,
      usageMonthly: this.readNumber(data.usage_monthly) ?? 0,
      limit: this.readNumber(data.limit),
      limitRemaining: this.readNumber(data.limit_remaining),
      limitReset:
        data.limit_reset === 'daily' ||
        data.limit_reset === 'weekly' ||
        data.limit_reset === 'monthly'
          ? data.limit_reset
          : null,
      expiresAt: this.readString(data.expires_at),
    };
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
  }
}
