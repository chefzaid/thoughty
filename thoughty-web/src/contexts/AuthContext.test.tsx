import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

type AuthContextValue = ReturnType<typeof useAuth>;

interface ContextSpyProps {
    onReady: (ctx: AuthContextValue) => void;
}

function ContextSpy({ onReady }: ContextSpyProps): null {
    const ctx = useAuth();
    useEffect(() => {
        onReady(ctx);
    }, [ctx, onReady]);
    return null;
}

function requireContext(ctx: AuthContextValue | undefined): AuthContextValue {
    if (!ctx) {
        throw new Error('Auth context was not ready');
    }
    return ctx;
}

describe('AuthContext', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws when useAuth is used outside provider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const Bad = (): null => {
            useAuth();
            return null;
        };
        expect(() => render(<Bad />)).toThrow('useAuth must be used within an AuthProvider');
        consoleSpy.mockRestore();
    });

    it('sets loading false when no token exists', async () => {
        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(requireContext(ctx).loading).toBe(false);
        });
    });

    it('loads user when access token exists', async () => {
        localStorage.setItem('accessToken', 'token');
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 1, email: 'user@example.com' })
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(requireContext(ctx).user?.email).toBe('user@example.com');
        });
    });

    it('registers user successfully and stores tokens', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 1, email: 'new@example.com' }
            })
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await requireContext(ctx).register('new@example.com', 'pass123', 'newuser', '');
        });
        expect(result!.success).toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
            body: JSON.stringify({
                email: 'new@example.com',
                password: 'pass123',
                username: 'newuser',
                website: '',
            }),
        }));
        expect(localStorage.getItem('accessToken')).toBe('access');
        await waitFor(() => {
            expect(requireContext(ctx).user?.email).toBe('new@example.com');
        });
    });

    it('handles register failure and sets error', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Registration failed' })
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await requireContext(ctx).register('bad@example.com', 'pass', 'bad');
        });
        expect(result!.success).toBe(false);
        await waitFor(() => {
            expect(requireContext(ctx).error).toBe('Registration failed');
        });
    });

    it('logs in successfully and stores tokens', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 2, email: 'login@example.com' }
            })
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await requireContext(ctx).login('login@example.com', 'pass', 'https://spam.example');
        });
        expect(result!.success).toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
            body: JSON.stringify({
                identifier: 'login@example.com',
                password: 'pass',
                website: 'https://spam.example',
            }),
        }));
        expect(localStorage.getItem('refreshToken')).toBe('refresh');
        await waitFor(() => {
            expect(requireContext(ctx).user?.email).toBe('login@example.com');
        });
    });

    it('refreshes token on 401 during authFetch', async () => {
        localStorage.setItem('accessToken', 'old');
        localStorage.setItem('refreshToken', 'refresh');

        let callCount = 0;
        (globalThis.fetch as Mock).mockImplementation((url: string) => {
            if (url === '/api/auth/me') {
                return Promise.resolve({
                    status: 200,
                    ok: true,
                    json: async () => ({ id: 1, email: 'refresh@example.com' }),
                });
            }
            if (url.endsWith('/refresh')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ accessToken: 'newtoken' })
                });
            }
            if (url === '/api/protected') {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({ status: 401, ok: false });
                }
                return Promise.resolve({ status: 200, ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ status: 200, ok: true });
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(requireContext(ctx).loading).toBe(false);
        });

        let response: Response | undefined;
        await act(async () => {
            response = await requireContext(ctx).authFetch('/api/protected');
        });
        expect(response!.ok).toBe(true);
        expect(callCount).toBe(2);
    });

    it('logs out and clears tokens', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 3, email: 'logout@example.com' }
            })
        });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        await act(async () => {
            await requireContext(ctx).login('logout@example.com', 'pass');
        });
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        await act(async () => {
            await requireContext(ctx).logout();
        });

        expect(localStorage.getItem('accessToken')).toBe(null);
        await waitFor(() => {
            expect(requireContext(ctx).user).toBe(null);
        });
    });

    it('supports password and account flows', async () => {
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'sent' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'reset' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'changed' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'deleted' }) });

        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        let forgot: { success: boolean } | undefined;
        await act(async () => {
            forgot = await requireContext(ctx).forgotPassword('a@b.com');
        });
        expect(forgot!.success).toBe(true);

        let reset: { success: boolean } | undefined;
        await act(async () => {
            reset = await requireContext(ctx).resetPassword('token', 'newpass');
        });
        expect(reset!.success).toBe(true);

        let change: { success: boolean } | undefined;
        await act(async () => {
            change = await requireContext(ctx).changePassword('old', 'new');
        });
        expect(change!.success).toBe(true);

        let del: { success: boolean } | undefined;
        await act(async () => {
            del = await requireContext(ctx).deleteAccount('pass');
        });
        expect(del!.success).toBe(true);
    });

    it('rejects Google sign-in when not configured', async () => {
        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await waitFor(() => {
            requireContext(ctx);
        });

        let error: unknown;
        await act(async () => {
            try {
                await requireContext(ctx).signInWithGoogle();
            } catch (caughtError) {
                error = caughtError;
            }
        });

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Google Sign-In not configured');
    });
});
