import { getPublicPathForView, PAGE_LANGUAGES } from '../types/navigation.ts';

/** Where security researchers and scanners look for how to report a vulnerability (RFC 9116). */
export const SECURITY_TXT_PATH = '/.well-known/security.txt';

/**
 * How long a written `security.txt` stays valid. RFC 9116 asks for an `Expires` under a year away; the
 * build writes the file, so every release renews it, and one left a year without a release says it is stale.
 */
export const SECURITY_TXT_LIFETIME_DAYS = 364;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day the file expires, at midnight UTC, so builds made the same day write the same file. */
export function securityTxtExpiry(now: Date): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today + SECURITY_TXT_LIFETIME_DAYS * DAY_MS);
}

/**
 * The `security.txt` for the site at `origin`: reports go through the public Contact page, whose messages
 * reach the address the API is configured with (`CONTACT_EMAIL`), in either of the app's languages.
 */
export function buildSecurityTxt(origin: string, now: Date = new Date()): string {
  return [
    '# How to report a security vulnerability in Thoughty: write to us through the Contact page.',
    `Contact: ${origin}${getPublicPathForView('contact')}`,
    `Expires: ${securityTxtExpiry(now).toISOString()}`,
    `Preferred-Languages: ${PAGE_LANGUAGES.join(', ')}`,
    `Canonical: ${origin}${SECURITY_TXT_PATH}`,
    '',
  ].join('\n');
}
