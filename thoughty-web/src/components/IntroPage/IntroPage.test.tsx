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
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    expect(screen.getByText('Private writing, built to stay useful')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thoughty' })).toBeInTheDocument();
    expect(screen.getByText('Portable import and export')).toBeInTheDocument();
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
});
