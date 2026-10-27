import type { Entry } from '@/database/entities';
import { buildOnThisDayEmail, ON_THIS_DAY_EXCERPT_LENGTH, resolveOnThisDayLanguage } from './on-this-day-email-content';

const entry = (overrides: Partial<Entry>): Entry =>
  ({ id: 7, date: '2023-10-27', title: null, content: '', format: 'plain', ...overrides }) as Entry;

const input = {
  localDate: '2026-10-27',
  frontendUrl: 'https://thoughty.example.com',
  unsubscribeUrl: 'https://thoughty.example.com/unsubscribe?token=3.abc',
  oneClickUnsubscribeUrl: 'https://thoughty.example.com/api/on-this-day-email/unsubscribe?token=3.abc',
};

describe('On this day email content', () => {
  it('resolves French, and English for anything else', () => {
    expect(resolveOnThisDayLanguage('fr')).toBe('fr');
    expect(resolveOnThisDayLanguage('de')).toBe('en');
    expect(resolveOnThisDayLanguage(undefined)).toBe('en');
  });

  it('shows each entry’s title, a short plain excerpt, how long ago, and a link to open it', () => {
    const long = `# Lake day\n\nWe **swam** at the lake. ${'and the water was cold '.repeat(20)}SECRET-TAIL`;
    const email = buildOnThisDayEmail({
      ...input,
      language: 'en',
      entries: [
        { entry: entry({ id: 7, title: 'Lake <day>', content: long }), yearsAgo: 3 },
        { entry: entry({ id: 9, date: '2025-10-27', content: 'One year on' }), yearsAgo: 1 },
      ],
    });

    expect(email.subject).toBe('On this day in your journal');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('What you wrote on October 27 in years past.');
    expect(email.html).toContain('3 years ago · October 27, 2023');
    expect(email.html).toContain('1 year ago · October 27, 2025');
    expect(email.html).toContain('<h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 8px;">Lake &lt;day&gt;</h2>');
    expect(email.html).toContain('href="https://thoughty.example.com/journal?entry=7"');
    expect(email.html).toContain('Open “Lake &lt;day&gt;”');
    expect(email.html).toContain('Untitled entry');
    expect(email.html).toContain('We swam at the lake.');
    expect(email.html).not.toContain('SECRET-TAIL');
    expect(email.html).not.toContain('**');
    expect(email.html).toContain('href="https://thoughty.example.com/unsubscribe?token=3.abc"');

    const excerpt = email.text.split('\n').find((line) => line.startsWith('Lake day'))!;
    expect(excerpt.length).toBeLessThanOrEqual(ON_THIS_DAY_EXCERPT_LENGTH + 1);
    expect(email.text).toContain('https://thoughty.example.com/journal?entry=9');
    expect(email.text).toContain('Stop these emails: https://thoughty.example.com/unsubscribe?token=3.abc');
    expect(email.text).toContain('\nLake <day>\n');
    expect(email.text).not.toContain('**');
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://thoughty.example.com/api/on-this-day-email/unsubscribe?token=3.abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('writes the email in French', () => {
    const email = buildOnThisDayEmail({
      ...input,
      language: 'fr',
      entries: [
        { entry: entry({ title: 'Au lac', content: 'Baignade' }), yearsAgo: 3 },
        { entry: entry({ id: 9, date: '2025-10-27', content: '' }), yearsAgo: 1 },
      ],
    });

    expect(email.subject).toBe('Ce jour-là dans votre journal');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.html).toContain('Ce que vous avez écrit un 27 octobre, les années passées.');
    expect(email.html).toContain('Il y a 3 ans · 27 octobre 2023');
    expect(email.html).toContain('Il y a 1 an · 27 octobre 2025');
    expect(email.html).toContain('Ouvrir « Au lac »');
    expect(email.html).toContain('Entrée sans titre');
    expect(email.text).toContain('Ne plus recevoir ces e-mails: https://thoughty.example.com/unsubscribe?token=3.abc');
  });
});
