/**
 * Every machine-readable `code` the API sends in an error body, with the English `message` it sends by default.
 * Clients translate by `code` and fall back to `message`, so a code never changes meaning once released;
 * docs/architecture.md lists them. A call site may send a more specific message (with numbers or names) under
 * the same code.
 */
export const API_ERROR_MESSAGES = {
  // Generic codes, given by status to errors thrown without one (Nest's validation pipe, guards, rate limits).
  VALIDATION_FAILED: 'The request is invalid',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  PAYLOAD_TOO_LARGE: 'Payload too large',
  RATE_LIMITED: 'Too many requests',
  SERVICE_UNAVAILABLE: 'Service unavailable',
  BAD_GATEWAY: 'Bad gateway',
  INTERNAL_ERROR: 'Internal server error',

  // Sign-in, registration and sessions.
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_ACCOUNT_DELETED: 'This account has been deleted. Please contact support if you believe this is a mistake.',
  AUTH_EMAIL_TAKEN: 'Email already registered',
  AUTH_USERNAME_TAKEN: 'Username already taken',
  AUTH_INVALID_REQUEST: 'Invalid auth request',
  AUTH_INVALID_TOKEN: 'Invalid token payload',
  AUTH_GOOGLE_NOT_CONFIGURED: 'Google sign-in is not configured on this server',
  AUTH_GOOGLE_INVALID_CREDENTIAL: 'Invalid Google credential',
  AUTH_GOOGLE_EMAIL_UNVERIFIED: 'Google account email is missing or unverified',
  AUTH_KEYCLOAK_TOKEN_MISSING: 'Keycloak access token is missing',
  AUTH_KEYCLOAK_TOKEN_INVALID: 'Invalid Keycloak access token',
  AUTH_KEYCLOAK_IDENTITY_INCOMPLETE: 'Keycloak identity is incomplete or unverified',
  AUTH_REFRESH_TOKEN_MISSING: 'Refresh token is missing',
  AUTH_REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  AUTH_REFRESH_TOKEN_EXPIRED: 'Refresh token expired or revoked',
  AUTH_SESSION_NOT_FOUND: 'Session not found',
  AUTH_SESSION_IS_CURRENT: 'Use logout to end the current session',
  AUTH_CURRENT_REFRESH_TOKEN_REQUIRED: 'Current refresh token is required',
  USER_NOT_FOUND: 'User not found',

  // Password, account deletion and email verification.
  AUTH_INVALID_PASSWORD: 'Invalid password',
  AUTH_PASSWORD_REQUIRED: 'Password is required to delete account',
  AUTH_PASSWORD_NOT_SET: 'Cannot change password for OAuth accounts without existing password',
  AUTH_CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  AUTH_INVALID_RESET_TOKEN: 'Invalid or expired reset token',
  AUTH_INVALID_VERIFICATION_TOKEN: 'Invalid or expired verification token',
  EMAIL_DELIVERY_NOT_CONFIGURED: 'Email delivery is not configured.',

  // Two-factor authentication.
  AUTH_2FA_PASSWORD_ACCOUNTS_ONLY: 'Email two-factor authentication is available for password accounts only.',
  AUTH_2FA_EMAIL_NOT_VERIFIED: 'Verify your email before enabling two-factor authentication.',
  AUTH_2FA_ALREADY_ENABLED: 'Two-factor authentication is already enabled.',
  AUTH_2FA_NOT_ENABLED: 'Two-factor authentication is not enabled.',
  AUTH_2FA_CODE_NOT_SENT: 'Unable to send the verification code.',
  AUTH_2FA_INVALID_CHALLENGE: 'Invalid or expired two-factor challenge.',
  AUTH_INVALID_2FA_CODE: 'Invalid or expired verification code.',
  AUTH_2FA_CHALLENGE_USED: 'Two-factor challenge has already been used.',
  AUTH_2FA_UNAVAILABLE: 'Two-factor authentication is unavailable.',

  // Entries, tags, revisions and task lists.
  ENTRY_NOT_FOUND: 'Entry not found',
  ENTRIES_NOT_FOUND: 'No matching entries found',
  ENTRY_PIN_LIMIT_REACHED: 'Pinned entry limit reached',
  ENTRY_REVISION_NOT_FOUND: 'Revision not found',
  ENTRY_TASKS_MARKDOWN_ONLY: 'Only Markdown entries have task lists',
  ENTRY_TASK_CHANGED: 'That line is no longer a task. Reload the entry and try again.',
  TAG_RENAME_SAME_NAME: 'New tag name must be different',
  TAG_NOT_FOUND: 'No entries found with that tag',
  RECYCLE_BIN_ENTRIES_NOT_FOUND: 'No matching entries in the recycle bin',

  // Diaries and settings.
  DIARY_NOT_FOUND: 'Diary not found',
  DIARY_NAME_TAKEN: 'A diary with this name already exists',
  DIARY_DEFAULT_NOT_DELETABLE: 'Cannot delete the default diary',
  SETTINGS_RESERVED: 'Settings cannot be changed here',

  // Saved searches.
  SAVED_SEARCH_NOT_FOUND: 'Saved search not found',
  SAVED_SEARCH_NAME_TAKEN: 'A saved search with this name already exists',
  SAVED_SEARCH_LIMIT_REACHED: 'Saved search limit reached',

  // Attachments and audio transcription.
  ATTACHMENT_NOT_FOUND: 'Attachment not found',
  ATTACHMENT_FILE_NOT_FOUND: 'File not found',
  ATTACHMENT_FILE_MISSING: 'No file provided',
  ATTACHMENT_TYPE_NOT_ALLOWED: 'File type is not allowed',
  ATTACHMENT_TOO_LARGE: 'File size exceeds the maximum',
  ATTACHMENT_EXPORT_TOO_LARGE: 'Attachment exceeds the export size limit',
  ATTACHMENT_NOT_AUDIO: 'Only audio attachments can be transcribed',
  TRANSCRIPTION_FAILED: 'Audio transcription request failed',

  // Import, export and books.
  IMPORT_CONTENT_REQUIRED: 'File content is required',
  IMPORT_FILE_TOO_LARGE: 'File too large',
  IMPORT_TOO_MANY_ENTRIES: 'Too many entries',
  APP_IMPORT_IN_PROGRESS: 'These entries are already being imported',
  BOOK_COVER_INVALID: 'Cover image must be a PNG or JPEG file no larger than 2 MB.',
  BOOK_TOO_LARGE_FOR_VERSION: 'Generated book is too large to save as a version.',
  BOOK_VERSION_NOT_FOUND: 'Book version not found',
  BOOK_AI_NARRATIVE_KEY_REQUIRED:
    'AI narrative requires an OpenRouter API key on the server. Disable the AI narrative option to download a plain book.',
  BOOK_AI_FRAMING_KEY_REQUIRED:
    'AI chapter framing requires an OpenRouter API key on the server. Disable chapter introductions and summaries to generate the book without them.',

  // AI features and the OpenRouter key.
  AI_KEY_NOT_CONFIGURED: 'OpenRouter API key is not configured',
  AI_KEY_REJECTED: 'OpenRouter rejected this API key',
  AI_PERSONAL_KEY_REQUIRED: 'Add a personal OpenRouter API key to view usage',
  AI_CONTENT_REQUIRED: 'Entry content is required',
  AI_TAGGED_ENTRIES_REQUIRED: 'Tagged entries are required for inspiration',
  AI_PROVIDER_FAILED: 'OpenRouter request failed',

  // Cloud sync.
  CLOUD_NOT_CONNECTED: 'Not connected to this cloud provider',
  CLOUD_CONNECTION_EXPIRED: 'Cloud connection expired. Please reconnect.',
  CLOUD_UNKNOWN_PROVIDER: 'Unknown provider',
  CLOUD_AUTHORIZATION_REJECTED: 'The cloud provider did not accept this sign-in. Please connect again.',
  CLOUD_PROVIDER_FAILED: 'The cloud provider could not complete the request',

  // Guided memoir.
  MEMOIR_UNKNOWN_QUESTION: 'Unknown memoir question',
  MEMOIR_NOT_STARTED: 'The guided memoir has not been started',
  MEMOIR_ALREADY_STARTED: 'The guided memoir is already started',
  MEMOIR_DIARY_REQUIRED: 'Choose a diary for your memoir first',
  MEMOIR_ANSWER_EMPTY: 'Write an answer or attach a recording',
  MEMOIR_ALREADY_ANSWERED: 'This question already has an answer',

  // Stats and the year in review.
  STATS_INVALID_DATE_RANGE: 'The start date must be before or equal to the end date',
  REVIEW_YEAR_EMPTY: 'There are no entries to read in this year',
  REVIEW_MOOD_UNAVAILABLE: 'The mood of the year could not be read right now',

  // Social features and feature requests.
  SOCIAL_CANNOT_FOLLOW_SELF: 'You cannot follow yourself',
  SOCIAL_CANNOT_LIKE_OWN_ENTRY: 'You cannot like your own entry',
  SOCIAL_CANNOT_LIKE_OWN_COMMENT: 'You cannot like your own comment',
  COMMENT_NOT_FOUND: 'Comment not found',
  FEATURE_REQUEST_NOT_FOUND: 'Feature request not found',
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES;

export const API_ERROR_CODES = Object.keys(API_ERROR_MESSAGES) as ApiErrorCode[];
