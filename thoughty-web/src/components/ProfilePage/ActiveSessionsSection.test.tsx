import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActiveSessionsSection from './ActiveSessionsSection';

const authContextMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: authContextMock.useAuth,
}));

const { useAuth } = await import('../../contexts/AuthContext');
const mockedUseAuth = vi.mocked(useAuth);

const sessions = [
  {
    id: 1,
    current: true,
    createdAt: '2026-06-21T10:00:00.000Z',
    expiresAt: '2026-06-28T10:00:00.000Z',
  },
  {
    id: 2,
    current: false,
    createdAt: '2026-06-20T10:00:00.000Z',
    expiresAt: '2026-06-27T10:00:00.000Z',
  },
];

function createJsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('ActiveSessionsSection', () => {
  const authFetch = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${params.id}` : key);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('refreshToken', 'current-refresh-token');
    authFetch.mockResolvedValue(createJsonResponse(sessions));
    mockedUseAuth.mockReturnValue({
      authFetch,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('loads active sessions and marks the current session', async () => {
    render(<ActiveSessionsSection isDark={true} t={t} />);

    expect(await screen.findByText('currentSession')).toBeInTheDocument();
    expect(screen.getByText('sessionNumber 2')).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith('/api/auth/sessions', {
      headers: { 'X-Refresh-Token': 'current-refresh-token' },
    });
  });

  it('disables revocation for the current session', async () => {
    render(<ActiveSessionsSection isDark={true} t={t} />);

    await screen.findByText('currentSession');

    const revokeButtons = screen.getAllByRole('button', { name: 'revoke' });
    expect(revokeButtons[0]).toBeDisabled();
    expect(revokeButtons[1]).not.toBeDisabled();
  });

  it('revokes a selected non-current session and reloads sessions', async () => {
    const user = userEvent.setup();
    authFetch
      .mockResolvedValueOnce(createJsonResponse(sessions))
      .mockResolvedValueOnce(createJsonResponse({ success: true }))
      .mockResolvedValueOnce(createJsonResponse([sessions[0]]));

    render(<ActiveSessionsSection isDark={false} t={t} />);

    await screen.findByText('sessionNumber 2');
    await user.click(screen.getAllByRole('button', { name: 'revoke' })[1]!);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/api/auth/sessions/2', {
        method: 'DELETE',
        headers: { 'X-Refresh-Token': 'current-refresh-token' },
      });
    });
    expect(await screen.findByText('sessionRevoked')).toBeInTheDocument();
  });

  it('revokes all other sessions', async () => {
    const user = userEvent.setup();
    authFetch
      .mockResolvedValueOnce(createJsonResponse(sessions))
      .mockResolvedValueOnce(createJsonResponse({ success: true }))
      .mockResolvedValueOnce(createJsonResponse([sessions[0]]));

    render(<ActiveSessionsSection isDark={false} t={t} />);

    await screen.findByText('sessionNumber 2');
    await user.click(screen.getByRole('button', { name: 'signOutOtherSessions' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'X-Refresh-Token': 'current-refresh-token' },
      });
    });
    expect(await screen.findByText('otherSessionsRevoked')).toBeInTheDocument();
  });

  it('shows a load error without claiming there are no sessions', async () => {
    authFetch.mockResolvedValueOnce(createJsonResponse({ message: 'Unavailable' }, false));

    render(<ActiveSessionsSection isDark={true} t={t} />);

    expect(await screen.findByText('sessionsLoadError')).toBeInTheDocument();
    expect(screen.queryByText('noActiveSessions')).not.toBeInTheDocument();
  });
});
