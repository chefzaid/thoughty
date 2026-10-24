import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntroPage from './IntroPage';
import { getTranslation } from '../../utils/translations';

describe('IntroPage', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation('en', key as never, params);

  it('renders the expanded landing content, screenshots, and feature sections', () => {
    render(
      <IntroPage
        t={t}
        onOpenJournal={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    expect(screen.getByText('Private writing, built to stay useful')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thoughty' })).toBeInTheDocument();
    expect(screen.getByText('Portable import and export')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A guided memoir, one question a week' })).toBeInTheDocument();
    expect(screen.getByText('Useful after the writing')).toBeInTheDocument();
    expect(screen.getByText('The main workflows are visible before you sign up.')).toBeInTheDocument();
    expect(screen.getByText('A focused journal surface')).toBeInTheDocument();
    expect(screen.getByText('Open a journal you can keep using years from now.')).toBeInTheDocument();
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

    const signUpButton = screen.getAllByRole('button', { name: 'Sign Up' }).at(0);
    const signInButton = screen.getAllByRole('button', { name: 'Sign In' }).at(0);
    expect(signUpButton).toBeDefined();
    expect(signInButton).toBeDefined();

    await user.click(signUpButton as HTMLElement);
    await user.click(signInButton as HTMLElement);

    expect(onSignUp).toHaveBeenCalledTimes(1);
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
    const openJournalButtons = screen.getAllByRole('button', { name: 'Open your journal' });
    expect(openJournalButtons).toHaveLength(2);

    await user.click(openJournalButtons[0] as HTMLElement);

    expect(onOpenJournal).toHaveBeenCalledTimes(1);
  });
});
