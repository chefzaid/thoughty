import type { ConfigService } from '@nestjs/config';

/** Development-only fallbacks; the same strings ship in `.env.example`. */
const DEVELOPMENT_SECRETS = {
  JWT_SECRET: 'your-secret-key-change-in-production',
  REFRESH_SECRET: 'refresh-secret-change-in-production',
} as const;

/** Example values that must never sign tokens in production. */
const PLACEHOLDER_SECRETS = new Set<string>([
  ...Object.values(DEVELOPMENT_SECRETS),
  'two-factor-secret-change-in-production',
]);

export const MIN_PRODUCTION_SECRET_LENGTH = 32;

type SigningSecretName = keyof typeof DEVELOPMENT_SECRETS;

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

function assertProductionSecret(name: string, value: string): void {
  if (!value) {
    throw new Error(`${name} is required in production`);
  }
  if (PLACEHOLDER_SECRETS.has(value)) {
    throw new Error(`${name} must not use the example value in production`);
  }
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    );
  }
}

/**
 * Reads a token-signing secret. Outside production a missing value falls back to the development
 * default; in production a missing, example, or short value throws, so the server refuses to start.
 */
export function getSigningSecret(configService: ConfigService, name: SigningSecretName): string {
  const value = configService.get<string>(name) ?? '';
  if (!isProduction()) {
    return value || DEVELOPMENT_SECRETS[name];
  }
  assertProductionSecret(name, value);
  return value;
}

/** The two-factor code HMAC key: `TWO_FACTOR_SECRET`, or one derived from the JWT secret. */
export function getTwoFactorSecret(configService: ConfigService): string {
  const value = configService.get<string>('TWO_FACTOR_SECRET') ?? '';
  if (!value) {
    return `${getSigningSecret(configService, 'JWT_SECRET')}:two-factor`;
  }
  if (isProduction()) {
    assertProductionSecret('TWO_FACTOR_SECRET', value);
  }
  return value;
}
