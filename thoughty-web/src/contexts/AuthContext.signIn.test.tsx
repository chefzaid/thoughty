import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { json, locationRestorers, renderAuth, renderSignedOut, routeFetch } from './AuthContext.test-helpers';

describe('AuthContext', () => {
    beforeEach(() => {
        routeFetch();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        locationRestorers.splice(0).forEach((restore) => restore());
    });

    it('registers user successfully and keeps tokens out of storage', async () => {
        const fetchMock = routeFetch({
            '/api/auth/register': [json({
                accessToken: 'access',
                user: { id: 1, email: 'new@example.com' }
            })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().register('new@example.com', 'pass123', 'newuser', '');
        });
        expect(result!.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
            body: JSON.stringify({
                email: 'new@example.com',
                password: 'pass123',
                username: 'newuser',
                website: '',
            }),
        }));
        expect(localStorage.length).toBe(0);
        await waitFor(() => {
            expect(auth.current().user?.email).toBe('new@example.com');
        });
        expect(auth.current().getAccessToken()).toBe('access');
    });

    it('handles register failure and sets error', async () => {
        routeFetch({
            '/api/auth/register': [json({ error: 'Registration failed' }, 400)],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().register('bad@example.com', 'pass', 'bad');
        });
        expect(result!.success).toBe(false);
        await waitFor(() => {
            expect(auth.current().error).toBe('Registration failed');
        });
    });

    it('logs in successfully with the access token in memory only', async () => {
        const fetchMock = routeFetch({
            '/api/auth/login': [json({
                accessToken: 'access',
                user: { id: 2, email: 'login@example.com' }
            })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().login('login@example.com', 'pass', 'https://spam.example');
        });
        expect(result!.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
            body: JSON.stringify({
                identifier: 'login@example.com',
                password: 'pass',
                website: 'https://spam.example',
            }),
        }));
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
        await waitFor(() => {
            expect(auth.current().user?.email).toBe('login@example.com');
        });
        expect(auth.current().getAccessToken()).toBe('access');
    });

    it('supports password and account flows', async () => {
        routeFetch({
            '/api/auth/forgot-password': [json({ message: 'sent' })],
            '/api/auth/reset-password': [json({ message: 'reset' })],
            '/api/auth/change-password': [json({ message: 'changed' })],
            '/api/auth/delete-account': [json({ message: 'deleted' })],
        });
        const auth = await renderSignedOut();

        let forgot: { success: boolean } | undefined;
        await act(async () => {
            forgot = await auth.current().forgotPassword('a@b.com');
        });
        expect(forgot!.success).toBe(true);

        let reset: { success: boolean } | undefined;
        await act(async () => {
            reset = await auth.current().resetPassword('token', 'newpass');
        });
        expect(reset!.success).toBe(true);

        let change: { success: boolean } | undefined;
        await act(async () => {
            change = await auth.current().changePassword('old', 'new');
        });
        expect(change!.success).toBe(true);

        let del: { success: boolean } | undefined;
        await act(async () => {
            del = await auth.current().deleteAccount('pass');
        });
        expect(del!.success).toBe(true);
        expect(auth.current().getAccessToken()).toBeNull();
    });

    it('completes a two-factor login without storing a partial session', async () => {
        const fetchMock = routeFetch({
            '/api/auth/login': [json({
                twoFactorRequired: true,
                challengeToken: 'challenge-one',
                expiresInSeconds: 600,
            })],
            '/api/auth/two-factor/resend': [json({
                twoFactorRequired: true,
                challengeToken: 'challenge-two',
                expiresInSeconds: 600,
            })],
            '/api/auth/two-factor/verify': [json({
                accessToken: 'access',
                user: { id: 2, email: 'protected@example.com', twoFactorEnabled: true },
            })],
        });
        const auth = await renderSignedOut();

        let loginResult;
        await act(async () => {
            loginResult = await auth.current().login('protected@example.com', 'password');
        });
        expect(loginResult).toEqual(expect.objectContaining({
            success: true,
            twoFactorRequired: true,
            challengeToken: 'challenge-one',
        }));
        expect(auth.current().getAccessToken()).toBeNull();

        let resendResult;
        await act(async () => {
            resendResult = await auth.current().resendTwoFactor('challenge-one');
        });
        expect(resendResult).toEqual(expect.objectContaining({ challengeToken: 'challenge-two' }));

        await act(async () => {
            await auth.current().verifyTwoFactor('challenge-two', '123456');
        });
        expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/auth/two-factor/verify',
            expect.objectContaining({ body: JSON.stringify({ challengeToken: 'challenge-two', code: '123456' }) }),
        );
        expect(auth.current().getAccessToken()).toBe('access');
        expect(localStorage.length).toBe(0);
        expect(auth.current().user?.twoFactorEnabled).toBe(true);
    });

    it('verifies an email and updates the authenticated user', async () => {
        const fetchMock = routeFetch({
            '/api/auth/refresh': [json({ accessToken: 'token' })],
            '/api/auth/me': [json({ id: 1, email: 'user@example.com', emailVerified: false })],
            '/api/auth/verify-email': [json({ message: 'verified' })],
        });
        const auth = renderAuth();

        await waitFor(() => expect(auth.current().user).not.toBeNull());

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().verifyEmail('verification-token');
        });

        expect(result?.success).toBe(true);
        expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/verify-email', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: 'verification-token' }),
        }));
        expect(auth.current().user?.emailVerified).toBe(true);
    });

    it('resends verification through the authenticated request path', async () => {
        const fetchMock = routeFetch({
            '/api/auth/resend-verification-email': [json({ message: 'sent' })],
        });
        const auth = await renderSignedOut();

        let result: { success: boolean } | undefined;
        await act(async () => {
            result = await auth.current().resendVerificationEmail();
        });

        expect(result?.success).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/resend-verification-email', expect.objectContaining({
            method: 'POST',
        }));
    });

    it('rejects Google sign-in when not configured', async () => {
        const auth = await renderSignedOut();

        let error: unknown;
        await act(async () => {
            try {
                await auth.current().signInWithGoogle();
            } catch (caughtError) {
                error = caughtError;
            }
        });

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('googleSignInUnavailable');
    });
});
