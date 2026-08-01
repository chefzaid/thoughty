import type { AiCredentialSource } from '@/database/entities';
import type { ConfigService } from '@/modules/config';
import { OPENROUTER_API_KEY_SETTING } from '@/modules/config/config.service';

export interface ResolvedOpenRouterCredential {
  apiKey: string;
  source: AiCredentialSource;
}

export async function resolveOpenRouterCredential(
  configService: Pick<ConfigService, 'getDecryptedConfig'> | undefined,
  userId: number,
): Promise<ResolvedOpenRouterCredential | null> {
  const personalKey = configService
    ? await configService.getDecryptedConfig(userId, OPENROUTER_API_KEY_SETTING)
    : '';
  if (personalKey?.startsWith('sk-or-v1-')) {
    return { apiKey: personalKey, source: 'personal' };
  }

  const serverKey = process.env.OPENROUTER_API_KEY?.trim() ?? '';
  return serverKey ? { apiKey: serverKey, source: 'server' } : null;
}
