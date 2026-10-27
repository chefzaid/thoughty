import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { BOOLEAN_TEXT, SMALL_NUMBER, UpdateConfigDto } from './config.dto';

const NumberText = (description: string) => ApiPropertyOptional({ type: String, pattern: SMALL_NUMBER.source, description });
const BooleanText = (description: string) => ApiPropertyOptional({ type: String, enum: BOOLEAN_TEXT, description });

/**
 * The preferences `GET /api/config` answers: the keys `POST /api/config` accepts, each as text
 * (numbers and true/false included), with defaults for the ones never saved. The number and on/off
 * settings `POST` also takes as JSON numbers and booleans are documented here as the text they are stored as.
 */
export class UserConfigDto extends OmitType(UpdateConfigDto, [
  'fontSize',
  'entriesPerPage',
  'maxPinnedEntries',
  'autoTagMaxTags',
  'highContrast',
  'readDates',
  'streakCard',
] as const) {
  @NumberText('Font size in pixels')
  fontSize?: string;

  @NumberText('Entries per page')
  entriesPerPage?: string;

  @NumberText('Maximum pinned entries')
  maxPinnedEntries?: string;

  @NumberText('Maximum tags suggested automatically (0 turns it off)')
  autoTagMaxTags?: string;

  @BooleanText('High contrast mode')
  highContrast?: string;

  @BooleanText('Read entry dates aloud')
  readDates?: string;

  @BooleanText('Show the writing streak card above the journal; shown unless false')
  streakCard?: string;
}

/** The runtime feature flags by name: `ai`, `bookConverter`, `cloudSync`, `publicSharing`, and any the provider adds. */
export const FEATURE_FLAGS_SCHEMA = {
  type: 'object',
  additionalProperties: { type: 'boolean' },
  example: { ai: true, bookConverter: true, cloudSync: true, publicSharing: true },
};
