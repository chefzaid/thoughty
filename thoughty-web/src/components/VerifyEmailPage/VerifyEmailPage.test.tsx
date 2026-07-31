import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VerifyEmailPage from './VerifyEmailPage';

const verifyEmail = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ verifyEmail }),
}));

const t = (key: string) => key;

function renderPage(path: string, onContinue = vi.fn()) {
  globalThis.history.replaceState({}, '', path);
  render(
    <BrowserRouter>
      <VerifyEmailPage t={t} theme="dark" onContinue={onContinue} />
    </BrowserRouter>,
  );
  return onContinue;
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies the route token and continues after success', async () => {
    verifyEmail.mockResolvedValue({ success: true });
    const onContinue = renderPage('/verify-email?token=valid-token');

    await waitFor(() => expect(screen.getByText('emailVerificationSuccess')).toBeInTheDocument());
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith('valid-token');

    await userEvent.click(screen.getByRole('button', { name: 'continueToThoughty' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows an error and retries a rejected token', async () => {
    verifyEmail
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });
    renderPage('/verify-email?token=retry-token');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('emailVerificationInvalid'));
    await userEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    await waitFor(() => expect(screen.getByText('emailVerificationSuccess')).toBeInTheDocument());

    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it('does not call the API when the token is missing', () => {
    renderPage('/verify-email');

    expect(screen.getByRole('alert')).toHaveTextContent('emailVerificationMissingToken');
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
