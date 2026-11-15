import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CompleteSignUpPage from './CompleteSignUpPage';

const completeSignUp = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ completeSignUp }),
}));

const t = (key: string) => key;

function renderPage(path: string, theme: 'light' | 'dark' = 'dark') {
  const handlers = { onComplete: vi.fn(), onSignUp: vi.fn(), onSignIn: vi.fn() };
  globalThis.history.replaceState({}, '', path);
  render(
    <BrowserRouter>
      <CompleteSignUpPage t={t} theme={theme} {...handlers} />
    </BrowserRouter>,
  );
  return handlers;
}

describe('CompleteSignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the account with the chosen password and continues', async () => {
    completeSignUp.mockResolvedValue({ success: true, isNewUser: true });
    const { onComplete } = renderPage('/complete-sign-up?token=link-token');

    expect(screen.getByRole('heading', { name: 'completeSignUpTitle' })).toBeInTheDocument();
    expect(screen.getByText('completeSignUpIntro')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('password'), 'Pass123!@');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));

    expect(completeSignUp).toHaveBeenCalledWith('link-token', 'Pass123!@', undefined);
    expect(onComplete).toHaveBeenCalled();
  });

  it('asks for the password before sending anything', async () => {
    renderPage('/complete-sign-up?token=link-token', 'light');

    // The required field stops the browser; a submit without it is refused here too
    screen.getByLabelText('password').removeAttribute('required');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));

    expect(screen.getByText('enterPassword', { selector: '.auth-error' })).toBeInTheDocument();
    expect(completeSignUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText('password')).toHaveClass('light');
  });

  it('asks for another username when the one chosen is taken, then sends it', async () => {
    completeSignUp
      .mockResolvedValueOnce({ success: false, error: 'apiError_AUTH_USERNAME_TAKEN' })
      .mockResolvedValueOnce({ success: true });
    const { onComplete } = renderPage('/complete-sign-up?token=link-token');

    await userEvent.type(screen.getByLabelText('password'), 'Pass123!@');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));
    expect(await screen.findByText('completeSignUpUsernameTaken')).toBeInTheDocument();

    screen.getByLabelText('username').removeAttribute('required');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));
    expect(screen.getByText('enterUsername', { selector: '.auth-error' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('username'), ' other ');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));
    expect(completeSignUp).toHaveBeenLastCalledWith('link-token', 'Pass123!@', 'other');
    expect(onComplete).toHaveBeenCalled();
  });

  it.each(['apiError_AUTH_INVALID_SIGN_UP_TOKEN', 'apiError_AUTH_EMAIL_TAKEN'])(
    'offers to sign up again or sign in once the link cannot work (%s)',
    async (error) => {
      completeSignUp.mockResolvedValue({ success: false, error });
      const { onSignUp, onSignIn } = renderPage('/complete-sign-up?token=used');

      await userEvent.type(screen.getByLabelText('password'), 'Pass123!@');
      await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));

      expect(await screen.findByText(error)).toBeInTheDocument();
      expect(screen.queryByLabelText('password')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'signUpAgain' }));
      await userEvent.click(screen.getByRole('button', { name: 'signIn' }));
      expect(onSignUp).toHaveBeenCalled();
      expect(onSignIn).toHaveBeenCalled();
    },
  );

  it('keeps the form after a wrong password, and uses its own words when the answer has none', async () => {
    completeSignUp
      .mockResolvedValueOnce({ success: false, error: 'apiError_AUTH_INVALID_PASSWORD' })
      .mockResolvedValueOnce({ success: false });
    renderPage('/complete-sign-up?token=link-token');

    await userEvent.type(screen.getByLabelText('password'), 'Wrong123!');
    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));
    expect(await screen.findByText('apiError_AUTH_INVALID_PASSWORD')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'completeSignUpSubmit' }));
    expect(await screen.findByText('completeSignUpFailed')).toBeInTheDocument();
    expect(screen.getByLabelText('password')).toBeInTheDocument();
  });

  it('explains a link without its token', () => {
    renderPage('/complete-sign-up');

    expect(screen.getByText('completeSignUpMissingToken')).toBeInTheDocument();
    expect(screen.queryByLabelText('password')).not.toBeInTheDocument();
    expect(screen.queryByText('completeSignUpIntro')).not.toBeInTheDocument();
  });
});
