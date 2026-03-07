import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

interface AuthContextValue {
    user: { email: string } | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<{ success: boolean }>;
    register: (email: string, password: string, username: string) => Promise<{ success: boolean }>;
    logout: () => Promise<void>;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    forgotPassword: (email: string) => Promise<{ success: boolean }>;
    resetPassword: (token: string, password: string) => Promise<{ success: boolean }>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean }>;
    deleteAccount: (password: string) => Promise<{ success: boolean }>;
    signInWithGoogle: () => Promise<{ success: boolean }>;
}

interface ContextSpyProps {
    onReady: (ctx: AuthContextValue) => void;
}

function ContextSpy({ onReady }: ContextSpyProps): null {
    const ctx = useAuth() as AuthContextValue;
    useEffect(() => {
        onReady(ctx);
    }, [ctx, onReady]);
    return null;
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
            expect(ctx).toBeTruthy();
            expect(ctx!.loading).toBe(false);
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
            expect(ctx!.user?.email).toBe('user@example.com');
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

        const result = await ctx!.register('new@example.com', 'pass123', 'newuser');
        expect(result.success).toBe(true);
        expect(localStorage.getItem('accessToken')).toBe('access');
        await waitFor(() => {
            expect(ctx!.user?.email).toBe('new@example.com');
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

        const result = await ctx!.register('bad@example.com', 'pass', 'bad');
        expect(result.success).toBe(false);
        await waitFor(() => {
            expect(ctx!.error).toBe('Registration failed');
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

        const result = await ctx!.login('login@example.com', 'pass');
        expect(result.success).toBe(true);
        expect(localStorage.getItem('refreshToken')).toBe('refresh');
        await waitFor(() => {
            expect(ctx!.user?.email).toBe('login@example.com');
        });
    });

    it('refreshes token on 401 during authFetch', async () => {
        localStorage.setItem('accessToken', 'old');
        localStorage.setItem('refreshToken', 'refresh');

        let callCount = 0;
        (globalThis.fetch as Mock).mockImplementation((url: string) => {
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

        const response = await ctx!.authFetch('/api/protected');
        expect(response.ok).toBe(true);
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

        await ctx!.login('logout@example.com', 'pass');
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        await ctx!.logout();

        expect(localStorage.getItem('accessToken')).toBe(null);
        await waitFor(() => {
            expect(ctx!.user).toBe(null);
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

        const forgot = await ctx!.forgotPassword('a@b.com');
        expect(forgot.success).toBe(true);

        const reset = await ctx!.resetPassword('token', 'newpass');
        expect(reset.success).toBe(true);

        const change = await ctx!.changePassword('old', 'new');
        expect(change.success).toBe(true);

        const del = await ctx!.deleteAccount('pass');
        expect(del.success).toBe(true);
    });

    it('rejects Google sign-in when not configured', async () => {
        let ctx: AuthContextValue | undefined;
        render(
            <AuthProvider>
                <ContextSpy onReady={(v) => { ctx = v; }} />
            </AuthProvider>
        );

        await expect(ctx!.signInWithGoogle()).rejects.toThrow('Google Sign-In not configured');
    });
});
