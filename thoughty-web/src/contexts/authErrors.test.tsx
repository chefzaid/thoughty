import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { getTranslation } from '../utils/translations';
import { AuthProvider, useAuth } from './AuthContext';
import { loginWithPassword, registerWithPassword, resendTwoFactorChallenge, verifyTwoFactorLogin } from './authRequests';
import { disableTwoFactor, enableTwoFactor, startTwoFactorSetup } from './twoFactorRequests';

type AuthContextValue = ReturnType<typeof useAuth>;

const answer = (body: unknown, status: number) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => '',
}) as unknown as Response;

/** Every request gets the same answer, except the session refresh on start, which finds no session. */
function answerAll(body: unknown, status: number): void {
    globalThis.fetch = vi.fn(async (url: string) => (
        url === '/api/auth/refresh' ? answer({ message: 'Refresh token is missing' }, 401) : answer(body, status)
    )) as unknown as typeof fetch;
}

function ContextSpy({ onReady }: Readonly<{ onReady: (ctx: AuthContextValue) => void }>): null {
    const ctx = useAuth();
    useEffect(() => onReady(ctx), [ctx, onReady]);
    return null;
}

async function renderAuth(): Promise<() => AuthContextValue> {
    let ctx: AuthContextValue | undefined;
    render(<AuthProvider><ContextSpy onReady={(value) => { ctx = value; }} /></AuthProvider>);
    await waitFor(() => expect(ctx?.loading).toBe(false));
    return () => ctx!;
}

describe('auth error messages', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['sign-in', () => loginWithPassword({ identifier: 'a', password: 'b', website: '' }), 'authFailed'],
        ['sign-up', () => registerWithPassword({ email: 'a@b.c', password: 'b', username: 'a', website: '' }), 'authFailed'],
        ['code check', () => verifyTwoFactorLogin('challenge', '123456'), 'twoFactorVerificationFailed'],
        ['code resend', () => resendTwoFactorChallenge('challenge'), 'twoFactorResendFailed'],
    ])('names a %s failure the API did not explain with a translation key', async (_label, request, key) => {
        answerAll({}, 500);

        await expect(request()).rejects.toThrow(key);
        expect(getTranslation('fr', key)).not.toBe(key);
    });

    it('reports an empty sign-in answer as an unavailable server', async () => {
        answerAll(null, 200);

        await expect(loginWithPassword({ identifier: 'a', password: 'b', website: '' })).rejects.toThrow('serverUnavailable');
    });

    it.each([
        ['setup', () => startTwoFactorSetup(globalThis.fetch), 'twoFactorSetupFailed'],
        ['enable', () => enableTwoFactor(globalThis.fetch, 'challenge', '123456'), 'twoFactorEnableFailed'],
        ['disable', () => disableTwoFactor(globalThis.fetch, 'password'), 'twoFactorDisableFailed'],
    ])('names a two-factor %s failure with a translation key', async (_label, request, key) => {
        answerAll({}, 500);

        await expect(request()).rejects.toThrow(key);
    });

    it('keeps the API message when it sends one', async () => {
        answerAll({ message: 'Invalid credentials' }, 401);

        await expect(loginWithPassword({ identifier: 'a', password: 'b', website: '' })).rejects.toThrow('Invalid credentials');
    });

    it('returns translation keys from the account actions the screen shows', async () => {
        answerAll({}, 500);
        const auth = await renderAuth();

        const results: Array<{ error?: string }> = [];
        await act(async () => {
            results.push(
                await auth().forgotPassword('a@b.c'),
                await auth().changePassword('old', 'new'),
                await auth().deleteAccount('password'),
            );
        });

        expect(results.map((result) => result.error)).toEqual(['forgotPasswordFailed', 'passwordChangeFailed', 'deleteAccountFailed']);
    });
});
