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

const renderAtCurrentAddress = (onContinue = vi.fn()) => {
  const view = render(
    <BrowserRouter>
      <VerifyEmailPage t={t} theme="dark" onContinue={onContinue} />
    </BrowserRouter>,
  );
  return { onContinue, unmount: view.unmount };
};

function renderPage(path: string, onContinue = vi.fn()) {
  globalThis.history.replaceState({}, '', path);
  return renderAtCurrentAddress(onContinue).onContinue;
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies the route token and continues after success', async () => {
    verifyEmail.mockResolvedValue({ success: true });
    const onContinue = renderPage('/verify-email?token=valid-token');

    expect(await screen.findByText('emailVerificationSuccess')).toBeInTheDocument();
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
    expect(await screen.findByText('emailVerificationSuccess')).toBeInTheDocument();

    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it('takes the token out of the address and its history entry at once', () => {
    verifyEmail.mockReturnValue(new Promise(() => {}));
    const lengthBefore = globalThis.history.length;
    renderPage('/verify-email?token=secret-token');

    expect(globalThis.location.pathname).toBe('/verify-email');
    expect(globalThis.location.search).toBe('');
    expect(globalThis.history.length).toBe(lengthBefore);
    expect(verifyEmail).toHaveBeenCalledWith('secret-token');
  });

  it('still shows a verification that went through after a reload, without asking again', async () => {
    verifyEmail.mockResolvedValue({ success: true });
    globalThis.history.replaceState({}, '', '/verify-email?token=valid-token');
    const first = renderAtCurrentAddress();
    expect(await screen.findByText('emailVerificationSuccess')).toBeInTheDocument();
    first.unmount();

    // The reload: the same history entry, whose address no longer has the token
    renderAtCurrentAddress();

    expect(screen.getByText('emailVerificationSuccess')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('asks to open the link again after a reload that came before any success', async () => {
    verifyEmail.mockResolvedValue({ success: false });
    globalThis.history.replaceState({}, '', '/verify-email?token=retry-token');
    const first = renderAtCurrentAddress();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('emailVerificationInvalid'));
    first.unmount();

    renderAtCurrentAddress();

    expect(screen.getByRole('alert')).toHaveTextContent('emailVerificationMissingToken');
    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('leaves the address alone when the writer has left before the answer', async () => {
    let answer: (value: { success: boolean }) => void = () => {};
    verifyEmail.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    globalThis.history.replaceState({}, '', '/verify-email?token=slow-token');
    const { unmount } = renderAtCurrentAddress();
    unmount();
    globalThis.history.replaceState({ left: true }, '', '/journal');

    answer({ success: true });
    await Promise.resolve();

    expect(globalThis.location.pathname).toBe('/journal');
    expect(globalThis.history.state).toEqual({ left: true });
  });

  it('does not call the API when the token is missing', () => {
    renderPage('/verify-email');

    expect(screen.getByRole('alert')).toHaveTextContent('emailVerificationMissingToken');
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
