import { buildYearReviewEmail } from './year-review-email-content';
import type { YearRecap } from './year-recap.service';

const links = {
  frontendUrl: 'https://thoughty.example.com',
  unsubscribeUrl: 'https://thoughty.example.com/unsubscribe?token=year.3.abc',
  oneClickUnsubscribeUrl: 'https://thoughty.example.com/api/email-unsubscribe?token=year.3.abc',
};

const recap = (overrides: Partial<YearRecap> = {}): YearRecap => ({
  year: 2026,
  diaryId: null,
  entries: 142,
  words: 51234,
  writingDays: 120,
  longestStreak: 18,
  busiestMonth: { month: 3, entries: 21 },
  topTags: [{ tag: 'family', count: 40 }, { tag: 'work<b>', count: 12 }],
  mood: { average: 3.6, entries: 90 },
  ...overrides,
});

describe('year in review email content', () => {
  it('tells the year in numbers, its streak, busiest month, top tags and recorded mood, and links to its review', () => {
    const email = buildYearReviewEmail({ ...links, language: 'en', recap: recap({ diaryId: 4 }) });

    expect(email.subject).toBe('Your 2026 in your journal');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('>Your 2026 in review</h1>');
    expect(email.html).toContain('A look back at what you wrote in 2026.');
    expect(email.html).toContain('>Your year in numbers</h2>');
    expect(email.html).toContain(
      '<li>142 entries</li><li>51,234 words</li><li>120 days with writing</li>' +
        '<li>Longest streak: 18 days in a row</li><li>Busiest month: March, with 21 entries</li>',
    );
    expect(email.html).toContain('<li>Top tags: #family (40), #work&lt;b&gt; (12)</li>');
    expect(email.html).toContain('<li>Average mood: 3.6 out of 5 (Good), from 90 entries with a mood.</li>');
    expect(email.html).toContain('href="https://thoughty.example.com/review?year=2026&amp;diary=4"');
    expect(email.html).toContain('>Open your 2026 in review</a>');
    expect(email.html).toContain('href="https://thoughty.example.com/unsubscribe?token=year.3.abc"');
    expect(email.html).toContain('you turned on the year in review email');

    expect(email.text).toContain('Your year in numbers\n- 142 entries\n- 51,234 words\n- 120 days with writing\n- Longest streak: 18 days in a row');
    expect(email.text).toContain('Open your 2026 in review: https://thoughty.example.com/review?year=2026&diary=4');
    expect(email.text).toContain('Stop these emails: https://thoughty.example.com/unsubscribe?token=year.3.abc');
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://thoughty.example.com/api/email-unsubscribe?token=year.3.abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('says one of everything in the singular, and leaves out tags and mood the year does not have', () => {
    const email = buildYearReviewEmail({
      ...links,
      language: 'en',
      recap: recap({ entries: 1, words: 1, writingDays: 1, longestStreak: 1, busiestMonth: { month: 12, entries: 1 }, topTags: [], mood: null }),
    });

    expect(email.text).toContain('- 1 entry\n- 1 word\n- 1 day with writing\n- Longest streak: 1 day in a row\n- Busiest month: December, with 1 entry');
    expect(email.text).not.toContain('Top tags');
    expect(email.text).not.toContain('Average mood');
    expect(email.html).toContain('href="https://thoughty.example.com/review?year=2026"');
  });

  it('is written in French', () => {
    const email = buildYearReviewEmail({
      ...links,
      language: 'fr',
      recap: recap({ entries: 1, words: 900, busiestMonth: { month: 8, entries: 1 } }),
    });

    expect(email.subject).toBe('Votre année 2026 dans votre journal');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.html).toContain('>Votre bilan 2026</h1>');
    expect(email.text).toContain('Un regard sur ce que vous avez écrit en 2026.');
    expect(email.text).toContain(
      'Votre année en chiffres\n- 1 entrée\n- 900 mots\n- 120 jours d’écriture\n' +
        '- Plus longue série : 18 jours d’affilée\n- Mois le plus actif : août, avec 1 entrée',
    );
    expect(email.text).toContain('- Tags populaires : #family (40), #work<b> (12)');
    expect(email.text).toContain('- Humeur moyenne : 3,6 sur 5 (Bonne), sur 90 entrées avec une humeur.');
    expect(email.text).toContain('Ouvrir votre bilan 2026: https://thoughty.example.com/review?year=2026');
    expect(email.text).toContain('Ne plus recevoir ces e-mails: https://thoughty.example.com/unsubscribe?token=year.3.abc');
    expect(email.text).toContain('le bilan de l’année par e-mail');
  });

  it('tells the year without any number in quiet mode', () => {
    const email = buildYearReviewEmail({ ...links, language: 'en', quietMode: true, recap: recap() });

    expect(email.text).toContain('Your year\n- Top tags: #family, #work<b>\n- Your mood on the whole: Good.');
    expect(email.html).toContain('>Your year</h2>');
    for (const count of ['142', '51,234', '120', '18', '21', '(40)', '3.6', 'Busiest', 'streak']) {
      expect(email.text).not.toContain(count);
      expect(email.html).not.toContain(count);
    }
    expect(email.text).toContain('Open your 2026 in review: https://thoughty.example.com/review?year=2026');
  });

  it('leaves the section out in quiet mode when the year has neither tags nor moods', () => {
    const email = buildYearReviewEmail({ ...links, language: 'en', quietMode: true, recap: recap({ topTags: [], mood: null }) });

    expect(email.html).not.toContain('<h2');
    expect(email.text).not.toContain('Your year\n');
    expect(email.text).toContain('Open your 2026 in review');
  });
});
