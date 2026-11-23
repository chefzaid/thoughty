import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { StrictBoolean } from '../validation/strict-input.decorators';

/**
 * The `aiConsent` field of an AI request about one entry or one text: true once the writer saw exactly what the
 * request sends and agreed, which a diary that asks before each AI request (`ai_mode` `ask`) requires.
 */
export function AiConsentProperty(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      description:
        'The writer saw what this request sends and agreed to it. A diary that asks before each AI request refuses ' +
        'the request without it (`403 DIARY_AI_CONSENT_REQUIRED`); other diaries ignore it.',
      type: Boolean,
    }),
    IsOptional(),
    StrictBoolean(),
  );
}
