import { describe, expect, it } from 'vitest';

import { buildSecurityTxt, SECURITY_TXT_LIFETIME_DAYS, SECURITY_TXT_PATH, securityTxtExpiry } from './securityTxt';

const ORIGIN = 'https://thoughty.test';

/** The fields of a security.txt, by name, in the order they are written (comments left out). */
function fields(text: string): [string, string][] {
  return text.split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf(': ');
    return [line.slice(0, separator), line.slice(separator + 2)];
  });
}

describe('security.txt', () => {
  it('points reports to the Contact page, in English or French, and names its own address', () => {
    const text = buildSecurityTxt(ORIGIN, new Date('2026-11-26T15:30:00Z'));

    expect(SECURITY_TXT_PATH).toBe('/.well-known/security.txt');
    expect(text.startsWith('# ')).toBe(true);
    expect(text.endsWith('\n')).toBe(true);
    expect(fields(text)).toEqual([
      ['Contact', `${ORIGIN}/contact`],
      ['Expires', '2027-11-25T00:00:00.000Z'],
      ['Preferred-Languages', 'en, fr'],
      ['Canonical', `${ORIGIN}/.well-known/security.txt`],
    ]);
  });

  it('expires under a year after the day it is written, the same for every build of that day', () => {
    const morning = securityTxtExpiry(new Date('2028-02-29T00:00:00Z'));
    const evening = securityTxtExpiry(new Date('2028-02-29T23:59:59Z'));

    expect(SECURITY_TXT_LIFETIME_DAYS).toBeLessThan(365);
    expect(evening).toEqual(morning);
    expect(morning.toISOString()).toBe('2029-02-27T00:00:00.000Z');
  });

  it('is written with the current date when none is given', () => {
    const expires = fields(buildSecurityTxt(ORIGIN)).find(([name]) => name === 'Expires')?.[1] ?? '';
    const daysAway = (Date.parse(expires) - Date.now()) / (24 * 60 * 60 * 1000);

    expect(daysAway).toBeGreaterThan(SECURITY_TXT_LIFETIME_DAYS - 1);
    expect(daysAway).toBeLessThanOrEqual(SECURITY_TXT_LIFETIME_DAYS);
  });
});
