import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TwoFactorSection from './TwoFactorSection';

const authFetch = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'verified@example.com',
      username: 'verified',
      authProvider: 'local',
      emailVerified: true,
      twoFactorEnabled: false,
    },
    authFetch,
  }),
}));

const t = (key: string): string => key;
const jsonResponse = (body: object): Response => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

describe('TwoFactorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFetch.mockResolvedValueOnce(jsonResponse({
      enabled: false,
      available: true,
      emailVerified: true,
    }));
  });

  it('enables and disables email two-factor authentication', async () => {
    const user = userEvent.setup();
    authFetch
      .mockResolvedValueOnce(jsonResponse({ challengeToken: 'setup-challenge' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    render(<TwoFactorSection isDark t={t} />);

    await waitFor(() => expect(authFetch).toHaveBeenCalledWith('/api/auth/two-factor/status'));
    await user.click(screen.getByRole('button', { name: 'enableTwoFactor' }));
    await user.type(await screen.findByLabelText('twoFactorCode'), '123456');
    await user.click(screen.getByRole('button', { name: 'confirmTwoFactor' }));

    await screen.findByText('twoFactorEnabledSuccess');
    expect(authFetch).toHaveBeenCalledWith('/api/auth/two-factor/enable', expect.objectContaining({
      body: JSON.stringify({ challengeToken: 'setup-challenge', code: '123456' }),
    }));

    await user.click(screen.getByRole('button', { name: 'disableTwoFactor' }));
    await user.type(screen.getByLabelText('currentPassword'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'disableTwoFactor' }));

    await screen.findByText('twoFactorDisabledSuccess');
    expect(authFetch).toHaveBeenCalledWith('/api/auth/two-factor/disable', expect.objectContaining({
      body: JSON.stringify({ password: 'Password123!' }),
    }));
  });

  it('explains when email verification is still required', async () => {
    authFetch.mockReset().mockResolvedValueOnce(jsonResponse({
      enabled: false,
      available: true,
      emailVerified: false,
    }));
    render(<TwoFactorSection isDark={false} t={t} />);

    expect(await screen.findByText('twoFactorVerifyEmailFirst')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'enableTwoFactor' })).not.toBeInTheDocument();
  });
});
