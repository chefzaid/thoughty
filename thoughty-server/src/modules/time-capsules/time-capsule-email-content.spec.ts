import { buildTimeCapsuleEmail } from './time-capsule-email-content';

describe('buildTimeCapsuleEmail', () => {
  const input = {
    entry: { id: 12, date: '2026-10-27', title: 'Dear <future> me', content: `**Hello** ${'word '.repeat(80)}` },
    // 23:30 UTC on 27 October is already the 28th in Paris
    sealedAt: new Date('2026-10-27T23:30:00Z'),
    timeZone: 'Europe/Paris',
    frontendUrl: 'https://thoughty.example',
  };

  it('says when it was sealed and written, with the title, a short plain excerpt and the permalink', () => {
    const email = buildTimeCapsuleEmail({ ...input, language: 'en' });

    expect(email.subject).toBe('Your time capsule has opened');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('On October 28, 2026, you sealed an entry until today.');
    expect(email.html).toContain('Written on October 27, 2026');
    expect(email.html).toContain('Dear &lt;future&gt; me');
    expect(email.html).toContain('href="https://thoughty.example/journal?entry=12"');
    expect(email.text).toContain('https://thoughty.example/journal?entry=12');
    const excerpt = email.text.split('\n').find((line) => line.startsWith('Hello'))!;
    expect(excerpt.length).toBeLessThanOrEqual(200);
    expect(email.text).not.toContain('**');
  });

  it('is a one-off the writer scheduled, so it has no unsubscribe link or header', () => {
    const email = buildTimeCapsuleEmail({ ...input, language: 'en' });

    expect(email.headers).toBeUndefined();
    expect(email.html).not.toContain('unsubscribe');
    expect(email.text).toContain('It is the only email the capsule sends.');
  });

  it('is written in French for French writers, and names an untitled entry', () => {
    const email = buildTimeCapsuleEmail({ ...input, language: 'fr', entry: { ...input.entry, title: null } });

    expect(email.subject).toBe('Votre capsule temporelle s’est ouverte');
    expect(email.html).toContain('<html lang="fr">');
    expect(email.text).toContain('Le 28 octobre 2026, vous avez scellé une entrée jusqu’à aujourd’hui.');
    expect(email.text).toContain('Écrite le 27 octobre 2026');
    expect(email.text).toContain('Entrée sans titre');
  });
});
