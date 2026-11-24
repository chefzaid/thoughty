import { renderAccountDeletionEmail, renderTwoFactorCodeEmail } from './account-notice-emails';

describe('renderTwoFactorCodeEmail', () => {
  it('writes the sign-in code in English, in HTML and plain text', () => {
    const email = renderTwoFactorCodeEmail('123456', 10, 'login', 'en');

    expect(email.subject).toBe('Your Thoughty security code');
    expect(email.html).toContain('<div lang="en"');
    expect(email.html).toContain('>123456</p>');
    expect(email.html).toContain('Use this code to finish signing in to Thoughty.');
    expect(email.html).toContain('This code expires in 10 minutes and can be used once.');
    expect(email.text.split('\n')[0]).toBe('Your Thoughty security code is 123456.');
    expect(email.text).toContain('If you did not ask for this code, change your password.');
  });

  it('writes the sign-in code in French', () => {
    const email = renderTwoFactorCodeEmail('654321', 10, 'login', 'fr');

    expect(email.subject).toBe('Votre code de sécurité Thoughty');
    expect(email.html).toContain('<div lang="fr"');
    expect(email.html).toContain('>654321</p>');
    expect(email.html).toContain('Utilisez ce code pour terminer votre connexion à Thoughty.');
    expect(email.html).toContain('Ce code expire dans 10 minutes et ne sert qu’une fois.');
    expect(email.text.split('\n')[0]).toBe('Votre code de sécurité Thoughty est 654321.');
    expect(email.text).toContain('changez votre mot de passe');
    expect(email.text).not.toContain('code is');
  });

  it.each([
    ['enable', 'en', 'turn on two-factor authentication'],
    ['enable', 'fr', 'activer la double authentification'],
    ['content-pin', 'en', 'confirm the change to your Thoughty PIN'],
    ['content-pin', 'fr', 'modification de votre code PIN Thoughty'],
  ] as const)('says what the %s code confirms in %s', (purpose, language, words) => {
    const email = renderTwoFactorCodeEmail('111111', 10, purpose, language);

    expect(email.html).toContain(words);
    expect(email.text).toContain(words);
    expect(email.text).not.toContain('signing in');
  });

  it('writes a single minute in the singular', () => {
    expect(renderTwoFactorCodeEmail('1', 1, 'login', 'en').text).toContain('expires in 1 minute and');
    expect(renderTwoFactorCodeEmail('1', 1, 'login', 'fr').text).toContain('expire dans 1 minute et');
  });

  it.each([undefined, 'de', ''])('writes English for %p', (language) => {
    expect(renderTwoFactorCodeEmail('123456', 10, 'login', language).subject).toBe('Your Thoughty security code');
  });

  it('escapes the code in HTML', () => {
    expect(renderTwoFactorCodeEmail('<b>1</b>', 10, 'login', 'en').html).toContain('&lt;b&gt;1&lt;/b&gt;');
  });
});

describe('renderAccountDeletionEmail', () => {
  it('confirms the deletion in English', () => {
    const email = renderAccountDeletionEmail('en');

    expect(email.subject).toBe('Your Thoughty account is deleted');
    expect(email.html).toContain('<div lang="en"');
    expect(email.html).toContain('Your account is deleted');
    expect(email.html).toContain('permanently erased within 30 days');
    expect(email.text).toContain('Your Thoughty account was deleted, as you asked.');
    expect(email.text).toContain('Thank you for using Thoughty.');
  });

  it('confirms the deletion in French', () => {
    const email = renderAccountDeletionEmail('fr');

    expect(email.subject).toBe('Votre compte Thoughty est supprimé');
    expect(email.html).toContain('<div lang="fr"');
    expect(email.html).toContain('Votre compte est supprimé');
    expect(email.html).toContain('Votre compte Thoughty a été supprimé, comme vous l’avez demandé.');
    expect(email.html).toContain('effacés sous 30 jours');
    expect(email.text).toContain('Merci d’avoir utilisé Thoughty.');
    expect(email.text).not.toContain('deleted');
  });

  it('writes English for any other language', () => {
    expect(renderAccountDeletionEmail('es').subject).toBe('Your Thoughty account is deleted');
    expect(renderAccountDeletionEmail(undefined).html).toContain('<div lang="en"');
  });
});
