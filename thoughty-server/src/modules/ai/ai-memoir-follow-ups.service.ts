import { BadGatewayException, BadRequestException, Injectable, Optional } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from './ai-usage.service';
import {
  buildMemoirFollowUpsPrompt,
  MEMOIR_FOLLOW_UPS_INSTRUCTIONS,
  parseMemoirFollowUps,
  type MemoirFollowUpRequest,
} from './memoir-follow-ups';
import { completeOpenRouterChat } from './openrouter-chat';
import { resolveOpenRouterCredential } from './openrouter-credential.util';

/** Memoir interview mode: follow-up questions that deepen an answer, asked with the writer's prompt model. */
@Injectable()
export class AiMemoirFollowUpsService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  /**
   * Up to three questions grounded in the answer, none of those already asked; empty when the answer gives
   * nothing to build on. Refused with `AI_KEY_NOT_CONFIGURED` when AI is not available to the writer,
   * `AI_PROVIDER_FAILED` when the call fails or its answer cannot be read.
   */
  async suggest(userId: number, request: MemoirFollowUpRequest): Promise<string[]> {
    if (!(await resolveOpenRouterCredential(this.configService, userId))) {
      throw apiError(BadRequestException, 'AI_KEY_NOT_CONFIGURED');
    }

    const rawContent = await completeOpenRouterChat({ configService: this.configService, usageService: this.usageService }, userId, {
      defaultModel: this.defaultModel,
      modelSetting: 'openRouterPromptModel',
      temperature: 0.6,
      system: MEMOIR_FOLLOW_UPS_INSTRUCTIONS,
      user: buildMemoirFollowUpsPrompt(request),
    });
    const questions = rawContent ? parseMemoirFollowUps(rawContent, request.asked) : null;
    if (!questions) {
      throw apiError(BadGatewayException, 'AI_PROVIDER_FAILED');
    }
    return questions;
  }
}
