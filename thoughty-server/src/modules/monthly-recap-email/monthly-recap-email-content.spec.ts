import type { Entry } from '@/database/entities';
import { buildMonthlyRecapEmail } from './monthly-recap-email-content';
import type { MonthlyRecap } from './monthly-recap.service';

const links = {
  frontendUrl: 'https://thoughty.example.com',
  unsubscribeUrl: 'https://thoughty.example.com/unsubscribe?token=recap.3.abc',
  oneClickUnsubscribeUrl: 'https://thoughty.example.com/api/email-unsubscribe?token=recap.3.abc',
};

const memoryEntry = (overrides: Partial<Entry> = {}) =>
  ({
    entry: { id: 90, date: '2019-10-12', title: 'Harbour <night>', content: `We **walked** by the sea. ${'and the wind was cold '.repeat(20)}SECRET-TAIL`, format: 'markdown', ...overrides } as Entry,
    yearsAgo: 7,
  });

const recap = (overrides: Partial<MonthlyRecap> = {}): MonthlyRecap => ({
  year: 2026,
  month: 10,
  diaryId: null,
  entries: 12,
  words: 4321,
  writingDays: 9,
  topTags: [{ tag: 'family', count: 5 }, { tag: 'work<b>', count: 3 }],
  mood: { average: 3.6, entries: 7 },
  memory: memoryEntry(),
  ...overrides,
});

describe('monthly recap email content', () => {
  it('tells the month in numbers, its top tags and recorded mood, one memory, and links back to the year in review', () => {
    const email = buildMonthlyRecapEmail({ ...links, language: 'en', recap: recap({ diaryId: 4 }) });

    expect(email.subject).toBe('Your October 2026 in your journal');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('>October 2026</h1>');
    expect(email.html).toContain('A look back at what you wrote in October 2026.');
    expect(email.html).toContain('<li>12 entries</li><li>4,321 words</li><li>9 days with writing</li>');
    expect(email.html).toContain('<li>Top tags: #family (5), #work&lt;b&gt; (3)</li>');
    expect(email.html).toContain('<li>Average mood: 3.6 out of 5 (Good), from 7 entries with a mood.</li>');
    expect(email.html).toContain('A memory from October 2019');
    expect(email.html).toContain('7 years ago · October 12, 2019');
    expect(email.html).toContain('<h3 style="color: #1a1a1a; font-size: 18px; margin: 0 0 8px;">Harbour &lt;night&gt;</h3>');
    expect(email.html).toContain('href="https://thoughty.example.com/journal?entry=90"');
    expect(email.html).toContain('href="https://thoughty.example.com/review?year=2026&amp;diary=4"');
    expect(email.html).toContain('See your 2026 in review');
    expect(email.html).not.toContain('SECRET-TAIL');
    expect(email.html).not.toContain('**');
    expect(email.html).toContain('href="https://thoughty.example.com/unsubscribe?token=recap.3.abc"');

    expect(email.text).toContain('Your month in numbers\n- 12 entries\n- 4,321 words\n- 9 days with writing\n- Top tags: #family (5), #work<b> (3)');
    expect(email.text).toContain('A memory from October 2019\n\n7 years ago · October 12, 2019\nHarbour <night>\nWe walked by the sea.');
    expect(email.text).toContain('See your 2026 in review: https://thoughty.example.com/review?year=2026&diary=4');
    expect(email.text).toContain('Stop these emails: https://thoughty.example.com/unsubscribe?token=recap.3.abc');
    const excerpt = email.text.split('\n').find((line) => line.startsWith('We walked'))!;
    expect(excerpt.length).toBeLessThanOrEqual(201);
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://thoughty.example.com/api/email-unsubscribe?token=recap.3.abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('says one of each in the singular, and leaves out tags, mood and the memory when there are none', () => {
    const email = buildMonthlyRecapEmail({
      ...links,
      language: 'en',
      recap: recap({ entries: 1, words: 1, writingDays: 1, topTags: [], mood: null, memory: null }),
    });

    expect(email.html).toContain('<li>1 entry</li><li>1 word</li><li>1 day with writing</li></ul>');
    expect(email.text).not.toContain('Top tags');
    expect(email.text).not.toContain('Average mood');
    expect(email.text).not.toContain('A memory');
    expect(email.text).toContain('https://thoughty.example.com/review?year=2026\n');
  });

  it('brings back a memory in a month without writing', () => {
    const email = buildMonthlyRecapEmail({
      ...links,
      language: 'en',
      recap: recap({ month: 2, entries: 0, words: 0, writingDays: 0, topTags: [], mood: null, memory: memoryEntry({ date: '2024-02-03', title: null }) }),
    });

    expect(email.html).toContain('You didn’t write in February 2026. Here is a memory from an earlier year instead.');
    expect(email.html).not.toContain('Your month in numbers');
    expect(email.html).toContain('A memory from February 2024');
    expect(email.html).toContain('Untitled entry');
  });

  it('writes the email in French, with French numbers and elision', () => {
    const email = buildMonthlyRecapEmail({ ...links, language: 'fr', recap: recap({ entries: 1, writingDays: 1, mood: { average: 1.2, entries: 1 } }) });

    expect(email.subject).toBe('Votre mois dans votre journal : octobre 2026');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.html).toContain('>Octobre 2026</h1>');
    expect(email.html).toContain('Un regard sur ce que vous avez écrit en octobre 2026.');
    expect(email.text).toMatch(/- 1 entrée\n- 4\s321 mots\n- 1 jour d’écriture\n- Tags populaires : #family \(5\)/);
    expect(email.text).toContain('Humeur moyenne : 1,2 sur 5 (Très basse), sur 1 entrée avec une humeur.');
    expect(email.text).toContain('Un souvenir d’octobre 2019');
    expect(email.text).toContain('Il y a 7 ans · 12 octobre 2019');
    expect(email.text).toContain('Voir votre année 2026');
    expect(email.text).toContain('Ne plus recevoir ces e-mails: https://thoughty.example.com/unsubscribe?token=recap.3.abc');

    const march = buildMonthlyRecapEmail({ ...links, language: 'fr', recap: recap({ month: 3, entries: 0, memory: memoryEntry({ date: '2020-03-01' }) }) });
    expect(march.text).toContain('Un souvenir de mars 2020');
    expect(march.text).toContain('Vous n’avez pas écrit en mars 2026. Voici plutôt un souvenir d’une année passée.');
  });
});
