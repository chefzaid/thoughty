import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { json, locationRestorers, renderSignedOut, routeFetch } from './AuthContext.test-helpers';
import type { AuthResult } from './authTypes';

describe('AuthContext verify-first sign-up', () => {
    beforeEach(() => {
        routeFetch();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        locationRestorers.splice(0).forEach((restore) => restore());
    });

    it('starts no session when the server only emailed a link', async () => {
        routeFetch({
            '/api/auth/register': [json({ verificationRequired: true, message: 'Check your email' }, 202)],
        });
        const auth = await renderSignedOut();

        let result: AuthResult | undefined;
        await act(async () => {
            result = await auth.current().register('new@example.com', 'Pass123!@', 'newbie', '');
        });

        expect(result).toEqual({ success: true, verificationRequired: true });
        expect(auth.current().user).toBeNull();
        expect(auth.current().getAccessToken()).toBeNull();
    });

    it('creates the account from the link and signs in', async () => {
        const fetchMock = routeFetch({
            '/api/auth/register/complete': [json({
                accessToken: 'access',
                user: { id: 4, email: 'new@example.com', isNewUser: true },
            }, 201)],
        });
        const auth = await renderSignedOut();

        let result: AuthResult | undefined;
        await act(async () => {
            result = await auth.current().completeSignUp('link-token', 'Pass123!@');
        });

        expect(result).toEqual({ success: true, isNewUser: true });
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/register/complete', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: 'link-token', password: 'Pass123!@' }),
        }));
        await waitFor(() => expect(auth.current().user?.email).toBe('new@example.com'));
        expect(auth.current().getAccessToken()).toBe('access');
        expect(localStorage.length).toBe(0);
    });

    it('sends another username when one is given, and reports the API code of a refusal', async () => {
        const fetchMock = routeFetch({
            '/api/auth/register/complete': [json({ statusCode: 409, message: 'Username already taken', code: 'AUTH_USERNAME_TAKEN' }, 409)],
        });
        const auth = await renderSignedOut();

        let result: AuthResult | undefined;
        await act(async () => {
            result = await auth.current().completeSignUp('link-token', 'Pass123!@', 'other');
        });

        expect(result).toEqual({ success: false, error: 'apiError_AUTH_USERNAME_TAKEN' });
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/register/complete', expect.objectContaining({
            body: JSON.stringify({ token: 'link-token', password: 'Pass123!@', username: 'other' }),
        }));
        expect(auth.current().user).toBeNull();
    });

    it('falls back to its own message when the answer carries none', async () => {
        routeFetch({ '/api/auth/register/complete': [json({}, 500)] });
        const auth = await renderSignedOut();

        let result: AuthResult | undefined;
        await act(async () => {
            result = await auth.current().completeSignUp('link-token', 'Pass123!@');
        });

        expect(result).toEqual({ success: false, error: 'completeSignUpFailed' });
    });
});
