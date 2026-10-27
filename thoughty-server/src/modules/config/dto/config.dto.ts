import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Settings are stored as text. The web sends a few of them as numbers or booleans; those become
 * text here, while objects and arrays stay as they are so the string check rejects them.
 */
const ToSettingText = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    return typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : raw;
  });

function SettingText(maxLength: number, description: string, pattern?: RegExp) {
  return applyDecorators(
    ApiPropertyOptional({ type: String, maxLength, description, pattern: pattern?.source }),
    IsOptional(),
    ToSettingText(),
    IsString(),
    MaxLength(maxLength),
    ...(pattern ? [Matches(pattern)] : []),
  );
}

function SettingChoice(values: readonly string[], description: string) {
  return applyDecorators(
    ApiPropertyOptional({ type: String, enum: values, description }),
    IsOptional(),
    ToSettingText(),
    IsIn(values),
  );
}

const BOOLEAN_TEXT = ['true', 'false'] as const;
const SMALL_NUMBER = /^\d{1,3}$/;
const MODEL_ID_MAX_LENGTH = 300;
const MODEL_DESCRIPTION = 'OpenRouter model id, or empty for the default';

/**
 * The preferences a user may change through `POST /api/config`. Anything else, such as cloud
 * connection tokens, sync state, export format, or the encrypted OpenRouter key, is written only
 * by its own endpoint, and the global validation pipe rejects it here with 400.
 */
export class UpdateConfigDto {
  @SettingChoice(['light', 'dark'], 'Color theme')
  theme?: string;

  @SettingText(200, 'Display name')
  name?: string;

  @SettingText(10_000, 'Profile bio')
  bio?: string;

  @SettingText(320, 'Contact email shown on the profile')
  email?: string;

  @SettingText(10, 'Birthday as YYYY-MM-DD, or empty', /^(\d{4}-\d{2}-\d{2})?$/)
  birthday?: string;

  @SettingText(100, 'Gender')
  gender?: string;

  @SettingText(
    1_000_000,
    'Profile picture as a base64 image data URL or an http(s) URL, or empty',
    /^(data:image\/[\w.+-]+;base64,[\w+/=]*|https?:\/\/\S+)?$/i,
  )
  avatarUrl?: string;

  @SettingChoice(['system', 'serif', 'modern', 'mono'], 'Font family')
  fontFamily?: string;

  @SettingText(3, 'Font size in pixels', SMALL_NUMBER)
  fontSize?: string;

  @SettingText(7, 'Text color as #rrggbb, or empty for the theme default', /^(#[0-9a-fA-F]{6})?$/)
  fontColor?: string;

  @SettingChoice(BOOLEAN_TEXT, 'High contrast mode')
  highContrast?: string;

  @SettingText(1000, 'Text-to-speech voice URI, or empty for the default')
  ttsVoiceUri?: string;

  @SettingChoice(['en', 'fr'], 'Interface language')
  language?: string;

  @SettingText(3, 'Entries per page', SMALL_NUMBER)
  entriesPerPage?: string;

  @SettingText(3, 'Maximum pinned entries', SMALL_NUMBER)
  maxPinnedEntries?: string;

  @SettingChoice(['public', 'private'], 'Visibility of new entries')
  defaultVisibility?: string;

  @SettingChoice(BOOLEAN_TEXT, 'Read entry dates aloud')
  readDates?: string;

  @SettingChoice(BOOLEAN_TEXT, 'Show the writing streak card above the journal; shown unless false')
  streakCard?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterTagModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterWritingModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterChatModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterToneModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterSummaryModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterPromptModel?: string;

  @SettingText(MODEL_ID_MAX_LENGTH, MODEL_DESCRIPTION)
  openRouterBookModel?: string;

  @SettingText(3, 'Maximum tags suggested automatically (0 turns it off)', SMALL_NUMBER)
  autoTagMaxTags?: string;

  @SettingText(500_000, 'Tag colors and descriptions as serialized JSON')
  tagMetadata?: string;

  @SettingText(500_000, 'Custom entry templates as serialized JSON')
  entryTemplates?: string;

  @SettingChoice(['free', 'plus', 'pro'], 'Subscription plan')
  subscriptionPlan?: string;

  @SettingText(200, 'Payment method label')
  paymentMethodLabel?: string;
}

/** Every key `UpdateConfigDto` accepts; `GET /api/config` returns only these. */
export const USER_CONFIG_KEYS: ReadonlySet<string> = new Set<keyof UpdateConfigDto>([
  'theme',
  'name',
  'bio',
  'email',
  'birthday',
  'gender',
  'avatarUrl',
  'fontFamily',
  'fontSize',
  'fontColor',
  'highContrast',
  'ttsVoiceUri',
  'language',
  'entriesPerPage',
  'maxPinnedEntries',
  'defaultVisibility',
  'readDates',
  'streakCard',
  'openRouterModel',
  'openRouterTagModel',
  'openRouterWritingModel',
  'openRouterChatModel',
  'openRouterToneModel',
  'openRouterSummaryModel',
  'openRouterPromptModel',
  'openRouterBookModel',
  'autoTagMaxTags',
  'tagMetadata',
  'entryTemplates',
  'subscriptionPlan',
  'paymentMethodLabel',
]);
