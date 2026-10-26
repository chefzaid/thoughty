/** Shared setup for the `AuthContext` specs: a routed fetch mock, a context probe and a location stub. */
import { useEffect } from 'react';
import { expect, vi, type Mock } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

export type AuthContextValue = ReturnType<typeof useAuth>;

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

export interface MockResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}

export const json = (body: unknown, status = 200): MockResponse => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

/**
 * Routes fetch calls by URL. Each URL answers from its queue of responses, repeating the last;
 * an unlisted refresh answers 401 (no refresh token cookie), anything else an empty 200.
 */
export function routeFetch(routes: Record<string, MockResponse[]> = {}): Mock {
    const queues = new Map(Object.entries(routes).map(([url, responses]) => [url, [...responses]]));
    const fetchMock = vi.fn(async (url: string) => {
        const queue = queues.get(url);
        if (queue && queue.length > 0) {
            return queue.length > 1 ? queue.shift() : queue[0];
        }
        if (url === '/api/auth/refresh') {
            return json({ message: 'Refresh token is missing' }, 401);
        }
        return json({});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

export const callsTo = (fetchMock: Mock, url: string) =>
    fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url);

export function renderAuth(): { current: () => AuthContextValue } {
    let ctx: AuthContextValue | undefined;
    render(
        <AuthProvider>
            <ContextSpy onReady={(value) => { ctx = value; }} />
        </AuthProvider>
    );
    return { current: () => requireContext(ctx) };
}

/** Replaces window.location with a copy whose assign() is a spy, restored after each test. */
export function stubLocationAssign(): Mock {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...original, origin: original.origin, href: original.href, assign },
    });
    locationRestorers.push(() => Object.defineProperty(window, 'location', { configurable: true, value: original }));
    return assign;
}

export const locationRestorers: Array<() => void> = [];

export async function renderSignedOut(): Promise<{ current: () => AuthContextValue }> {
    const auth = renderAuth();
    await waitFor(() => expect(auth.current().loading).toBe(false));
    return auth;
}
