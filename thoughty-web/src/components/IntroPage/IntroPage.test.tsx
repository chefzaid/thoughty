import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntroPage from './IntroPage';
import { getTranslation } from '../../utils/translations';

describe('IntroPage', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation('en', key as never, params);

  it('renders the landing content and feature cards', () => {
    render(
      <IntroPage
        t={t}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    expect(screen.getByText('Private writing, built to stay useful')).toBeInTheDocument();
    expect(screen.getByText('Portable import and export')).toBeInTheDocument();
    expect(screen.getByText('Useful after the writing')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSignUp).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});