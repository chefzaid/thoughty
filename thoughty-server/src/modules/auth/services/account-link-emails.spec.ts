import { renderLinkEmail } from './account-link-emails';

const URL_WITH_QUOTES = 'https://thoughty.example/complete-sign-up?token=abc&x="1"';

describe('renderLinkEmail', () => {
  it('writes the sign-up link in French, with the link escaped in HTML and whole in the text', () => {
    const email = renderLinkEmail('signUpLink', URL_WITH_QUOTES, 'fr');

    expect(email.subject).toBe('Terminez la création de votre compte Thoughty');
    expect(email.html).toContain('<div lang="fr"');
    expect(email.html).toContain('Créer mon compte');
    expect(email.html).toContain('expire dans 24 heures');
    expect(email.html).toContain('href="https://thoughty.example/complete-sign-up?token=abc&amp;x=&quot;1&quot;"');
    expect(email.html).toContain('copiez ce lien dans votre navigateur');
    expect(email.text).toContain(URL_WITH_QUOTES);
    expect(email.text).toContain('saisissez le mot de passe choisi');
    expect(email.text).not.toContain('Finish');
  });

  it('writes the notice to an address with an account in French, with no link but the sign-in page', () => {
    const email = renderLinkEmail('signUpNotice', 'https://thoughty.example/login', 'fr');

    expect(email.subject).toBe('Quelqu’un a tenté de s’inscrire à Thoughty avec votre adresse e-mail');
    expect(email.html).toContain('Se connecter');
    expect(email.html).not.toContain('copiez ce lien');
    expect(email.text).toContain('« Mot de passe oublié ? »');
    expect(email.text).toContain('https://thoughty.example/login');
  });

  it('writes the address verification in French', () => {
    const email = renderLinkEmail('emailVerification', 'https://thoughty.example/verify-email?token=1', 'fr');

    expect(email.subject).toBe('Vérifiez votre adresse e-mail Thoughty');
    expect(email.html).toContain('Vérifier mon adresse');
    expect(email.text).toContain('https://thoughty.example/verify-email?token=1');
  });

  it.each([undefined, 'en', 'de', ''])('writes English for %p', (language) => {
    const email = renderLinkEmail('signUpLink', 'https://thoughty.example/x', language);

    expect(email.subject).toBe('Finish creating your Thoughty account');
    expect(email.html).toContain('<div lang="en"');
    expect(email.html).toContain('Create my account');
  });
});
