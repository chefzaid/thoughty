import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage from './ResetPasswordPage';

const resetPassword = vi.fn();
const forgotPassword = vi.fn();
const logout = vi.fn();
let isAuthenticated = false;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ resetPassword, forgotPassword, logout, isAuthenticated }),
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;
const STRONG = 'NewPass1!';

function renderPage(path: string, theme: 'light' | 'dark' = 'dark') {
  const onSignIn = vi.fn();
  globalThis.history.replaceState({ start: true }, '', path);
  render(
    <BrowserRouter>
      <ResetPasswordPage t={t} theme={theme} onSignIn={onSignIn} />
    </BrowserRouter>,
  );
  return { onSignIn };
}

async function choosePassword(password: string, confirmPassword = password) {
  if (password) await userEvent.type(screen.getByLabelText('newPassword'), password);
  if (confirmPassword) await userEvent.type(screen.getByLabelText('confirmPassword'), confirmPassword);
  await userEvent.click(screen.getByRole('button', { name: 'resetPasswordSubmit' }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated = false;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  it('takes the token out of the address and its history entry at once', () => {
    renderPage('/reset-password?token=secret-token');

    expect(globalThis.location.pathname).toBe('/reset-password');
    expect(globalThis.location.search).toBe('');
    expect(globalThis.history.length).toBe(1);
    expect(screen.getByRole('heading', { name: 'resetPasswordTitle' })).toBeInTheDocument();
    expect(screen.getByText('resetPasswordIntro')).toBeInTheDocument();
    expect(screen.getByLabelText('newPassword')).toHaveAccessibleDescription(/^passwordRequirements /);
    expect(screen.getByLabelText('newPassword')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('sets the new password with the link token, then offers to sign in', async () => {
    resetPassword.mockResolvedValue({ success: true });
    const { onSignIn } = renderPage('/reset-password?token=secret-token');

    await choosePassword(STRONG);

    expect(resetPassword).toHaveBeenCalledWith('secret-token', STRONG);
    expect(await screen.findByRole('status')).toHaveTextContent('resetPasswordDone');
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('newPassword')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'resetPasswordTitle' })).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: 'signIn' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('signs this browser out too when it was signed in', async () => {
    isAuthenticated = true;
    resetPassword.mockResolvedValue({ success: true });
    renderPage('/reset-password?token=secret-token');

    await choosePassword(STRONG);

    // Once the history entry holds the outcome, so the page signing out starts again still says it is done
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(globalThis.history.state?.usr).toEqual({ passwordReset: true });
    expect(screen.getByRole('status')).toHaveTextContent('resetPasswordDone');
  });

  it('still says the reset is done when signing out started the page again, and signs nobody out for it', () => {
    isAuthenticated = true;
    globalThis.history.replaceState({ usr: { passwordReset: true }, key: 'done', idx: 0 }, '', '/reset-password');
    render(
      <BrowserRouter>
        <ResetPasswordPage t={t} onSignIn={vi.fn()} />
      </BrowserRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('resetPasswordDone');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('newPassword')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'resetPasswordTitle' })).toHaveFocus();
    expect(logout).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing', '', '', 'enterNewPassword'],
    ['a password the API would refuse', 'password1', 'password1', 'passwordTooWeak'],
    ['a symbol the API does not count', 'Password1-', 'Password1-', 'passwordTooWeak'],
    ['no confirmation', STRONG, '', 'confirmPasswordPlaceholder'],
    ['a different confirmation', STRONG, 'NewPass2!', 'passwordsDoNotMatch'],
  ])('refuses %s before sending anything', async (_label, password, confirmPassword, message) => {
    renderPage('/reset-password?token=secret-token', 'light');

    await choosePassword(password, confirmPassword);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(resetPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('newPassword')).toHaveClass('light');
  });

  it('shows and hides both passwords', async () => {
    renderPage('/reset-password?token=secret-token');

    await userEvent.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(screen.getByLabelText('newPassword')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('confirmPassword')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'hidePassword' }));
    expect(screen.getByLabelText('newPassword')).toHaveAttribute('type', 'password');
  });

  it('keeps the form after another failure, in its own words when the answer has none', async () => {
    resetPassword
      .mockResolvedValueOnce({ success: false, error: 'apiError_VALIDATION_FAILED' })
      .mockResolvedValueOnce({ success: false });
    renderPage('/reset-password?token=secret-token');

    await choosePassword(STRONG);
    expect(screen.getByRole('alert')).toHaveTextContent('apiError_VALIDATION_FAILED');
    await userEvent.click(screen.getByRole('button', { name: 'resetPasswordSubmit' }));
    expect(screen.getByRole('alert')).toHaveTextContent('resetPasswordFailed');
    expect(screen.getByLabelText('newPassword')).toBeInTheDocument();
  });

  it('explains a used or expired link and sends a new one', async () => {
    resetPassword.mockResolvedValue({ success: false, error: 'apiError_AUTH_INVALID_RESET_TOKEN' });
    forgotPassword.mockResolvedValue({ success: true });
    renderPage('/reset-password?token=used-token');

    await choosePassword(STRONG);

    expect(screen.getByRole('alert')).toHaveTextContent('apiError_AUTH_INVALID_RESET_TOKEN');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'resetYourPassword' })).toHaveFocus());
    expect(screen.queryByLabelText('newPassword')).not.toBeInTheDocument();
    expect(screen.getByText('resetPasswordNewLinkIntro')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
    expect(screen.getByRole('alert')).toHaveTextContent('enterEmail');
    await userEvent.type(screen.getByLabelText('email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalidEmail');
    expect(forgotPassword).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('email'));
    await userEvent.type(screen.getByLabelText('email'), 'writer@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
    expect(forgotPassword).toHaveBeenCalledWith('writer@example.com');
    expect(screen.getByRole('status')).toHaveTextContent('resetEmailSent');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when a new link cannot be asked for, and goes back to sign in', async () => {
    forgotPassword
      .mockResolvedValueOnce({ success: false, error: 'apiError_RATE_LIMITED' })
      .mockResolvedValueOnce({ success: false });
    const { onSignIn } = renderPage('/reset-password');

    expect(screen.getByRole('alert')).toHaveTextContent('resetPasswordMissingToken');
    expect(screen.queryByText('resetPasswordIntro')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('email'), 'writer@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
    expect(screen.getByRole('alert')).toHaveTextContent('apiError_RATE_LIMITED');
    await userEvent.click(screen.getByRole('button', { name: 'sendResetLink' }));
    expect(screen.getByRole('alert')).toHaveTextContent('forgotPasswordFailed');

    await userEvent.click(screen.getByRole('button', { name: 'backToLogin' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('shows the sending state while the reset is on its way', async () => {
    let finish: (value: { success: boolean }) => void = () => undefined;
    resetPassword.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage('/reset-password?token=secret-token');

    await choosePassword(STRONG);
    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
    await act(async () => finish({ success: true }));
    expect(screen.getByRole('button', { name: 'signIn' })).toBeEnabled();
  });
});
