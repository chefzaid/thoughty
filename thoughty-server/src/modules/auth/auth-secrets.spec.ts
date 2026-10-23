import type { ConfigService } from '@nestjs/config';
import { getSigningSecret, getTwoFactorSecret } from './auth-secrets';

const config = (values: Record<string, string | undefined>) =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

const STRONG = 'a'.repeat(32);

describe('auth secrets', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  describe('outside production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('falls back to the development defaults', () => {
      expect(getSigningSecret(config({}), 'JWT_SECRET')).toBe(
        'your-secret-key-change-in-production',
      );
      expect(getSigningSecret(config({}), 'REFRESH_SECRET')).toBe(
        'refresh-secret-change-in-production',
      );
      expect(getTwoFactorSecret(config({}))).toBe(
        'your-secret-key-change-in-production:two-factor',
      );
    });

    it('uses configured values, however short', () => {
      expect(getSigningSecret(config({ JWT_SECRET: 'short' }), 'JWT_SECRET')).toBe('short');
      expect(getTwoFactorSecret(config({ TWO_FACTOR_SECRET: 'tf' }))).toBe('tf');
    });
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it.each(['JWT_SECRET', 'REFRESH_SECRET'] as const)('requires %s', (name) => {
      expect(() => getSigningSecret(config({}), name)).toThrow(`${name} is required in production`);
    });

    it.each([
      ['JWT_SECRET', 'your-secret-key-change-in-production'],
      ['REFRESH_SECRET', 'refresh-secret-change-in-production'],
      ['REFRESH_SECRET', 'your-secret-key-change-in-production'],
    ] as const)('refuses %s set to the example value', (name, value) => {
      expect(() => getSigningSecret(config({ [name]: value }), name)).toThrow(
        `${name} must not use the example value in production`,
      );
    });

    it.each(['JWT_SECRET', 'REFRESH_SECRET'] as const)('refuses a short %s', (name) => {
      expect(() => getSigningSecret(config({ [name]: 'a'.repeat(31) }), name)).toThrow(
        `${name} must be at least 32 characters in production`,
      );
    });

    it('accepts strong secrets', () => {
      expect(getSigningSecret(config({ JWT_SECRET: STRONG }), 'JWT_SECRET')).toBe(STRONG);
      expect(getTwoFactorSecret(config({ JWT_SECRET: STRONG }))).toBe(`${STRONG}:two-factor`);
      expect(getTwoFactorSecret(config({ TWO_FACTOR_SECRET: 'b'.repeat(64) }))).toBe(
        'b'.repeat(64),
      );
    });

    it('refuses a weak TWO_FACTOR_SECRET, and derives none from a missing JWT_SECRET', () => {
      expect(() =>
        getTwoFactorSecret(config({ TWO_FACTOR_SECRET: 'two-factor-secret-change-in-production' })),
      ).toThrow('TWO_FACTOR_SECRET must not use the example value in production');
      expect(() => getTwoFactorSecret(config({}))).toThrow('JWT_SECRET is required in production');
    });
  });
});
