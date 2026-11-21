import { renderNewSignInEmail } from './new-sign-in-email';

const signedInAt = new Date('2026-11-21T09:05:00Z');

describe('renderNewSignInEmail', () => {
  it('says which browser and system signed in and when, and links to the account activity', () => {
    const email = renderNewSignInEmail({
      language: 'en',
      software: { browser: 'Firefox', system: 'Windows' },
      signedInAt,
      frontendUrl: 'https://thoughty.example',
    });

    expect(email.subject).toBe('New sign-in to your Thoughty account');
    expect(email.text).toContain('Firefox on Windows');
    expect(email.text).toContain('November 21, 2026');
    expect(email.text).toContain('UTC');
    expect(email.text).toContain('Review account activity: https://thoughty.example/profile');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain('href="https://thoughty.example/profile"');
    expect(email.html).toContain('Turn them off in Profile › Privacy.');
  });

  it('is written in French for a French writer, and names an unknown browser and system plainly', () => {
    const email = renderNewSignInEmail({
      language: 'fr',
      software: { browser: null, system: null },
      signedInAt,
      frontendUrl: 'https://thoughty.example',
    });

    expect(email.subject).toBe('Nouvelle connexion à votre compte Thoughty');
    expect(email.text).toContain('un navigateur inconnu sous un système inconnu');
    expect(email.text).toContain('21 novembre 2026');
    expect(email.html).toContain('<html lang="fr">');
  });

  it('falls back to English for any other language, and escapes what it shows', () => {
    const email = renderNewSignInEmail({
      language: undefined,
      software: { browser: '<b>Edge</b>', system: 'macOS' },
      signedInAt,
      frontendUrl: 'https://thoughty.example',
    });

    expect(email.subject).toBe('New sign-in to your Thoughty account');
    expect(email.html).not.toContain('<b>Edge</b>');
    expect(email.html).toContain('&lt;b&gt;Edge&lt;/b&gt;');
  });
});
