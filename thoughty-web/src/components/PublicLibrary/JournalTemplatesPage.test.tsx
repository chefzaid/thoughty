import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getBuiltInEntryTemplates } from '../../utils/entryTemplates';
import { getTranslation, type Language } from '../../utils/translations';
import JournalTemplatesPage from './JournalTemplatesPage';

function renderPage(language: Language = 'en', isAuthenticated = false) {
  const handlers = { onSignUp: vi.fn(), onOpenJournal: vi.fn(), onBackHome: vi.fn() };
  const view = render(
    <JournalTemplatesPage
      t={(key, params) => getTranslation(language, key, params)}
      language={language}
      isAuthenticated={isAuthenticated}
      {...handlers}
    />,
  );
  return { ...handlers, ...view };
}

describe('JournalTemplatesPage', () => {
  it('shows every built-in template with its prompts and tags, and leads a visitor to sign up', async () => {
    const { onSignUp, unmount } = renderPage();
    const list = screen.getByRole('region', { name: 'Templates' });

    expect(within(list).getAllByRole('article')).toHaveLength(getBuiltInEntryTemplates('en').length);
    const gratitude = within(list).getByRole('article', { name: 'Gratitude journal' });
    expect(gratitude).toHaveTextContent('Today I am grateful for:');
    expect(within(gratitude).getByRole('list', { name: 'Tags' })).toHaveTextContent('#gratitude');
    // Markdown templates read as they look in an entry, not as raw markup
    const weekly = within(list).getByRole('article', { name: 'Weekly review' });
    expect(within(weekly).getByRole('heading', { name: 'Wins' })).toBeInTheDocument();
    expect(weekly).not.toHaveTextContent('## Wins');
    expect(within(list).getByRole('article', { name: 'Letter to my future self' }))
      .toHaveTextContent('Offers to seal the entry as a time capsule for 1 year.');
    expect(gratitude).not.toHaveTextContent('time capsule');
    expect(document.title).toBe('Journal templates and prompts · Thoughty');
    expect(screen.getByRole('link', { name: 'Writing a life story? See the memoir questions' }))
      .toHaveAttribute('href', '/memoir-questions');

    await userEvent.click(screen.getAllByRole('button', { name: 'Start your journal' })[1]!);
    expect(onSignUp).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.title).not.toContain('Journal templates');
  });

  it('speaks French and opens the journal for a signed-in writer', async () => {
    const { onOpenJournal } = renderPage('fr', true);

    expect(screen.getByRole('article', { name: 'Journal de gratitude' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Lettre à mon moi futur' }))
      .toHaveTextContent('Propose de sceller l’entrée en capsule temporelle pour 1 an.');
    await userEvent.click(screen.getAllByRole('button', { name: 'Ouvrir votre journal' })[0]!);
    expect(onOpenJournal).toHaveBeenCalledTimes(1);
  });
});
