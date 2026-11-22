import type { ConfigService } from '@/modules/config';
import { resolveAiModel } from './ai-model.util';
import type { AiUsageService } from './ai-usage.service';
import { resolveOpenRouterCredential } from './openrouter-credential.util';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface OpenRouterChatRequest {
  /** The model when the writer chose none, for this task or overall. */
  readonly defaultModel: string;
  /** The setting holding the writer's model for this task. */
  readonly modelSetting: string;
  readonly temperature: number;
  readonly system: string;
  /** The writer's request, or a whole conversation to answer the last message of. */
  readonly user: string | readonly OpenRouterChatMessage[];
}

export interface OpenRouterChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface OpenRouterChatServices {
  readonly configService: ConfigService;
  readonly usageService?: AiUsageService;
}

/**
 * Asks OpenRouter once for the writer, with their own key or the shared one, and records the usage.
 * The answer's text, or null when AI is not available to the writer, the call fails or the answer is empty.
 */
export async function completeOpenRouterChat(
  { configService, usageService }: OpenRouterChatServices,
  userId: number,
  request: OpenRouterChatRequest,
): Promise<string | null> {
  try {
    const credential = await resolveOpenRouterCredential(configService, userId);
    if (!credential) return null;
    const model = await resolveAiModel(configService, userId, request.defaultModel, request.modelSetting);
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Thoughty',
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature,
        messages: [
          { role: 'system', content: request.system },
          ...(typeof request.user === 'string' ? [{ role: 'user', content: request.user }] : request.user),
        ],
      }),
    });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenRouterResponse;
    await usageService?.recordResponse(userId, credential.source, model, data);
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
