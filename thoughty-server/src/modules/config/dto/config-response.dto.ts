import { UpdateConfigDto } from './config.dto';

/**
 * The preferences `GET /api/config` answers: the keys `POST /api/config` accepts, each as text
 * (numbers and true/false included), with defaults for the ones never saved.
 */
export class UserConfigDto extends UpdateConfigDto {}

/** The runtime feature flags by name: `ai`, `bookConverter`, `cloudSync`, `publicSharing`, and any the provider adds. */
export const FEATURE_FLAGS_SCHEMA = {
  type: 'object',
  additionalProperties: { type: 'boolean' },
  example: { ai: true, bookConverter: true, cloudSync: true, publicSharing: true },
};
