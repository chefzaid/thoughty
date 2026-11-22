import { BadGatewayException, BadRequestException, Injectable, Optional } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from './ai-usage.service';
import { buildEntriesChatSystemPrompt, type EntriesChatSource } from './entries-chat';
import { completeOpenRouterChat, type OpenRouterChatMessage } from './openrouter-chat';
import { resolveOpenRouterCredential } from './openrouter-credential.util';

/** Answers a conversation about several of the writer's entries at once, with the chat model. */
@Injectable()
export class AiEntriesChatService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  /**
   * The reply to the conversation's last message, citing the entries by their number. Refused with
   * `AI_KEY_NOT_CONFIGURED` when AI is not available to the writer, `AI_PROVIDER_FAILED` when the call
   * fails or the answer is empty.
   */
  async reply(
    userId: number,
    entries: readonly EntriesChatSource[],
    messages: readonly OpenRouterChatMessage[],
  ): Promise<string> {
    if (!(await resolveOpenRouterCredential(this.configService, userId))) {
      throw apiError(BadRequestException, 'AI_KEY_NOT_CONFIGURED');
    }

    const reply = await completeOpenRouterChat({ configService: this.configService, usageService: this.usageService }, userId, {
      defaultModel: this.defaultModel,
      modelSetting: 'openRouterChatModel',
      temperature: 0.5,
      system: buildEntriesChatSystemPrompt(entries),
      user: messages,
    });
    if (!reply) {
      throw apiError(BadGatewayException, 'AI_PROVIDER_FAILED');
    }
    return reply;
  }
}
