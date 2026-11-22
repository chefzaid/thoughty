import { buildWritingReminderEmail, type WritingReminder } from './writing-reminder-email-content';

const links = {
  frontendUrl: 'https://thoughty.example.com',
  unsubscribeUrl: 'https://thoughty.example.com/unsubscribe?token=remind.3.abc',
  oneClickUnsubscribeUrl: 'https://thoughty.example.com/api/email-unsubscribe?token=remind.3.abc',
};
const reminder = (overrides: Partial<WritingReminder> = {}): WritingReminder => ({ diaryId: null, currentStreak: 0, source: 'account', ...overrides });

describe('writing reminder email content', () => {
  it('nudges the writer to write today and opens the journal on the reminder’s diary', () => {
    const email = buildWritingReminderEmail({ ...links, language: 'en', reminder: reminder({ diaryId: 4, currentStreak: 1234 }) });

    expect(email.subject).toBe('A few lines for your journal today?');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('>Time to write</h1>');
    expect(email.html).toContain('You haven’t written today yet.');
    expect(email.html).toContain('You have written 1,234 days in a row. An entry today keeps it going.');
    expect(email.html).toContain('href="https://thoughty.example.com/journal?diary=4"');
    expect(email.html).toContain('>Write today’s entry</a>');
    expect(email.html).toContain('Need a question to start? Choose “Draw a card” in the composer.');
    expect(email.html).toContain('href="https://thoughty.example.com/unsubscribe?token=remind.3.abc"');

    expect(email.text).toContain('Time to write\n\nYou haven’t written today yet.');
    expect(email.text).toContain('You have written 1,234 days in a row. An entry today keeps it going.\n\nWrite today’s entry: https://thoughty.example.com/journal?diary=4');
    expect(email.text).toContain('Stop these emails: https://thoughty.example.com/unsubscribe?token=remind.3.abc');
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://thoughty.example.com/api/email-unsubscribe?token=remind.3.abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('opens the journal itself for all diaries, says one day in the singular, and leaves out a streak there is not', () => {
    const one = buildWritingReminderEmail({ ...links, language: 'en', reminder: reminder({ currentStreak: 1 }) });
    expect(one.html).toContain('href="https://thoughty.example.com/journal"');
    expect(one.text).toContain('You have written 1 day in a row.');

    const none = buildWritingReminderEmail({ ...links, language: 'en', reminder: reminder() });
    expect(none.text).not.toContain('in a row');
    expect(none.html).not.toContain('in a row');
    expect(none.text).toContain('You haven’t written today yet. A few lines are enough');
  });

  it('names Manage Diaries in the footer of a diary’s own reminder, in both languages', () => {
    const own = buildWritingReminderEmail({ ...links, language: 'en', reminder: reminder({ diaryId: 4, source: 'diary' }) });
    expect(own.text).toContain('you set a writing reminder hour for this diary in Manage Diaries');
    expect(own.text).toContain('https://thoughty.example.com/journal?diary=4');
    expect(own.html).not.toContain('Thoughty profile');
    const french = buildWritingReminderEmail({ ...links, language: 'fr', reminder: reminder({ diaryId: 4, source: 'diary' }) });
    expect(french.text).toContain('pour ce journal dans Gérer les journaux');
  });

  it('leaves the streak count out in quiet mode', () => {
    const email = buildWritingReminderEmail({ ...links, language: 'en', quietMode: true, reminder: reminder({ currentStreak: 9 }) });

    expect(email.text).not.toContain('9');
    expect(email.text).not.toContain('in a row');
    expect(email.text).toContain('Write today’s entry: https://thoughty.example.com/journal');
  });

  it('is written in French, with French plurals and the composer’s own words', () => {
    const email = buildWritingReminderEmail({ ...links, language: 'fr', reminder: reminder({ diaryId: 2, currentStreak: 12 }) });

    expect(email.subject).toBe('Quelques lignes pour votre journal aujourd’hui ?');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.html).toContain('>Un moment pour écrire</h1>');
    expect(email.text).toContain('Vous avez écrit 12 jours d’affilée. Une entrée aujourd’hui prolonge la série.');
    expect(email.text).toContain('Écrire l’entrée du jour: https://thoughty.example.com/journal?diary=2');
    expect(email.text).toContain('Choisissez « Tirer une carte » dans l’éditeur.');
    expect(email.text).toContain('Ne plus recevoir ces e-mails: https://thoughty.example.com/unsubscribe?token=remind.3.abc');
    expect(buildWritingReminderEmail({ ...links, language: 'fr', reminder: reminder({ currentStreak: 1 }) }).text).toContain('Vous avez écrit 1 jour d’affilée.');
  });
});
