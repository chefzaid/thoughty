import { buildMemoirQuestionEmail } from './memoir-email';
import { findMemoirQuestion } from './memoir-questions';

describe('buildMemoirQuestionEmail', () => {
  const question = findMemoirQuestion('places-journey')!;

  it('writes the email in the writer’s language and links to the question', () => {
    const email = buildMemoirQuestionEmail(question, 'fr', 'https://thoughty.example.com/app/');

    expect(email.subject).toBe('Votre question de la semaine pour vos mémoires');
    expect(email.question).toBe(question.text.fr);
    expect(email.actionLabel).toBe('Écrire ma réponse');
    expect(email.actionUrl).toBe('https://thoughty.example.com/memoir?question=places-journey');
    expect(email.footer).toContain('réglages de Mémoires');
  });

  it('uses English copy for English writers', () => {
    const email = buildMemoirQuestionEmail(question, 'en', 'http://localhost:5173');

    expect(email.heading).toBe('This week’s question for your memoir');
    expect(email.question).toBe('Which journey changed the way you saw the world?');
    expect(email.actionUrl).toBe('http://localhost:5173/memoir?question=places-journey');
  });
});
