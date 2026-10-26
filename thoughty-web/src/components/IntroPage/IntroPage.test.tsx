import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntroPage from './IntroPage';
import { getTranslation } from '../../utils/translations';

describe('IntroPage', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation('en', key as never, params);

  it('presents the journal, the memoir, the books, privacy, and the other features', () => {
    render(
      <IntroPage
        t={t}
        onOpenJournal={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Page sections' })).toBeInTheDocument();
    for (const heading of [
      'One place for everything you want to remember.',
      'A quiet page that gets out of the way',
      'Your life story, one question a week',
      'See your year, not just your entries',
      'From journal to a real book',
      'Private by design, helpful when you ask.',
      'Coming from Day One or Journey?',
      'Everything a lifelong journal needs.',
      'Your future self will want to read this.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole('img', { name: 'Thoughty preview: a journal entry, a memoir question, and a finished book' })).toBeInTheDocument();
    expect(screen.getByText('312 of 500 words this session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });

  it('links the navigation to the page sections', () => {
    render(
      <IntroPage
        t={t}
        onOpenJournal={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    for (const [name, href] of [['Features', '#features'], ['Memoir', '#memoir'], ['Privacy', '#privacy']] as const) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(document.querySelector(href)).not.toBeNull();
    }
  });

  it('calls the correct CTA handlers', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    const onSignUp = vi.fn();

    render(
      <IntroPage
        t={t}
        onOpenJournal={vi.fn()}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      />,
    );

    const startButtons = screen.getAllByRole('button', { name: 'Start your journal' });
    expect(startButtons).toHaveLength(3);
    await user.click(startButtons[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await user.click(screen.getAllByRole('button', { name: 'Sign In' }).at(0) as HTMLElement);

    expect(onSignUp).toHaveBeenCalledTimes(2);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('offers signed-in visitors their journal instead of the sign-up and sign-in buttons', async () => {
    const user = userEvent.setup();
    const onOpenJournal = vi.fn();

    render(
      <IntroPage
        t={t}
        isAuthenticated
        onOpenJournal={onOpenJournal}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Sign Up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start your journal' })).not.toBeInTheDocument();
    const openJournalButtons = screen.getAllByRole('button', { name: 'Open your journal' });
    expect(openJournalButtons).toHaveLength(4);

    await user.click(openJournalButtons[0] as HTMLElement);

    expect(onOpenJournal).toHaveBeenCalledTimes(1);
  });
});
