import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation, type Language } from '../../utils/translations';
import MemoirQuestionsPage from './MemoirQuestionsPage';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ authFetch }) }));

const CHAPTERS = [
  {
    id: 'childhood',
    title: { en: 'Childhood', fr: 'Enfance' },
    theme: false,
    questions: [
      { id: 'childhood-home', text: { en: 'What did the home you grew up in look like?', fr: 'À quoi ressemblait la maison de votre enfance ?' } },
      { id: 'childhood-play', text: { en: 'What games did you play as a child?', fr: 'À quels jeux jouiez-vous enfant ?' } },
    ],
  },
  {
    id: 'migration',
    title: { en: 'Migration', fr: 'Migration' },
    theme: true,
    questions: [{ id: 'migration-leaving', text: { en: 'Why did your family leave?', fr: 'Pourquoi votre famille est-elle partie ?' } }],
  },
];

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function renderPage(language: Language = 'en', isAuthenticated = false) {
  const handlers = { onSignUp: vi.fn(), onOpenMemoir: vi.fn(), onBackHome: vi.fn() };
  render(
    <MemoirQuestionsPage
      t={(key, params) => getTranslation(language, key, params)}
      language={language}
      isAuthenticated={isAuthenticated}
      {...handlers}
    />,
  );
  return handlers;
}

describe('MemoirQuestionsPage', () => {
  beforeEach(() => {
    authFetch.mockReset();
    document.title = 'Thoughty';
  });

  it('shows the year of questions by chapter, then the themes, and leads a visitor to sign up', async () => {
    authFetch.mockResolvedValue(ok({ chapters: CHAPTERS }));
    const handlers = renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading the questions...');
    const year = await screen.findByRole('region', { name: 'A year of questions' });
    expect(authFetch).toHaveBeenCalledWith('/api/memoir/questions');
    expect(year).toHaveTextContent('2 questions, one a week, in the order of a life.');
    const childhood = within(year).getByRole('region', { name: 'Childhood' });
    expect(within(childhood).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'What did the home you grew up in look like?',
      'What games did you play as a child?',
    ]);
    const themes = screen.getByRole('region', { name: 'Themes to add' });
    expect(within(themes).getByRole('region', { name: 'Migration' })).toHaveTextContent('Why did your family leave?');
    expect(within(year).queryByText('Why did your family leave?')).not.toBeInTheDocument();
    expect(document.title).toBe('Memoir questions to ask your parents, and yourself · Thoughty');
    expect(screen.getByRole('link', { name: 'Keeping a daily journal instead? See the journal templates' }))
      .toHaveAttribute('href', '/journal-templates');

    for (const start of screen.getAllByRole('button', { name: 'Start your memoir' })) await userEvent.click(start);
    expect(handlers.onSignUp).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(handlers.onBackHome).toHaveBeenCalledTimes(1);
  });

  it('speaks French and opens the memoir for a signed-in writer', async () => {
    authFetch.mockResolvedValue(ok({ chapters: CHAPTERS.slice(0, 1) }));
    const handlers = renderPage('fr', true);

    const year = await screen.findByRole('region', { name: 'Une année de questions' });
    expect(within(year).getByRole('region', { name: 'Enfance' })).toHaveTextContent('À quels jeux jouiez-vous enfant ?');
    expect(screen.queryByRole('region', { name: 'Thèmes à ajouter' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Ouvrir vos mémoires' })[0]!);
    expect(handlers.onOpenMemoir).toHaveBeenCalledTimes(1);
    expect(handlers.onSignUp).not.toHaveBeenCalled();
  });

  it('says when the questions cannot be loaded and tries again on request', async () => {
    authFetch.mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(ok({ chapters: CHAPTERS }));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The questions could not be loaded. Try again in a moment.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'A year of questions' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledTimes(2);
  });
});
