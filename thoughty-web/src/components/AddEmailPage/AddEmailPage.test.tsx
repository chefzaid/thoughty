import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddEmailPage from './AddEmailPage';

const auth = {
  user: { id: 1, email: 'user-1@invalid', emailMissing: true } as { id: number; email: string; emailMissing: boolean; pendingEmail?: string },
  addEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
  refreshAccountEmail: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key);

describe('AddEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: 1, email: 'user-1@invalid', emailMissing: true };
    auth.refreshAccountEmail.mockResolvedValue(undefined);
  });

  it('asks for an address, never showing the placeholder, and sends it', async () => {
    const user = userEvent.setup();
    auth.addEmail.mockResolvedValue({ success: true });
    render(<AddEmailPage t={t} theme="light" />);

    expect(screen.getByRole('heading', { name: 'addEmailTitle' })).toBeInTheDocument();
    expect(screen.queryByText(/user-1@invalid/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('email'), ' ada@example.com ');
    await user.click(screen.getByRole('button', { name: 'addEmailSubmit' }));

    expect(auth.addEmail).toHaveBeenCalledWith('ada@example.com');
    expect(auth.refreshAccountEmail).not.toHaveBeenCalled();
  });

  it('shows a refusal', async () => {
    const user = userEvent.setup();
    auth.addEmail.mockResolvedValueOnce({ success: false, error: 'apiError_AUTH_EMAIL_TAKEN' }).mockResolvedValueOnce({ success: false });
    render(<AddEmailPage t={t} />);

    await user.type(screen.getByLabelText('email'), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: 'addEmailSubmit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('apiError_AUTH_EMAIL_TAKEN');

    await user.click(screen.getByRole('button', { name: 'addEmailSubmit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('addEmailFailed');
  });

  it('waits for the link: reads the address again on opening and on coming back, resends, and offers another address', async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, pendingEmail: 'ada@example.com' };
    auth.resendVerificationEmail.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: 'apiError_RATE_LIMITED' });
    const { unmount } = render(<AddEmailPage t={t} />);

    expect(screen.getByText(/addEmailCheckInbox/)).toHaveTextContent('ada@example.com');
    await waitFor(() => expect(auth.refreshAccountEmail).toHaveBeenCalledTimes(1));
    act(() => {
      globalThis.dispatchEvent(new Event('focus'));
    });
    expect(auth.refreshAccountEmail).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'addEmailOpenedLink' }));
    expect(auth.refreshAccountEmail).toHaveBeenCalledTimes(3);
    expect(await screen.findByRole('status')).toHaveTextContent('addEmailNotConfirmedYet');

    await user.click(screen.getByRole('button', { name: 'addEmailResend' }));
    expect(await screen.findByRole('status')).toHaveTextContent('addEmailResent');
    await user.click(screen.getByRole('button', { name: 'addEmailResend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('apiError_RATE_LIMITED');

    await user.click(screen.getByRole('button', { name: 'signUpUseAnotherEmail' }));
    expect(screen.getByLabelText('email')).toBeInTheDocument();

    unmount();
    act(() => {
      globalThis.dispatchEvent(new Event('focus'));
    });
    expect(auth.refreshAccountEmail).toHaveBeenCalledTimes(3);
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    render(<AddEmailPage t={t} />);

    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
