import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasPendingKeycloakSsoAttempt, startKeycloakSso, takeKeycloakSsoPreferencesQuery } from './keycloakSso';

const PREFERENCES_KEY = 'thoughty.keycloak-sso-preferences';

describe('Keycloak sign-in', () => {
    afterEach(() => {
        sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it('keeps the visitor’s language and theme for the way back, and leaves for Keycloak', () => {
        const assign = vi.fn();
        vi.stubGlobal('location', { ...globalThis.location, assign });

        startKeycloakSso('https://thoughty.example/register', { language: 'fr', theme: 'light' });

        expect(hasPendingKeycloakSsoAttempt()).toBe(true);
        expect(assign).toHaveBeenCalledWith(
            `https://keycloak.swirlit.dev/oauth2/start?rd=${encodeURIComponent('https://thoughty.example/register')}`,
        );
        expect(takeKeycloakSsoPreferencesQuery()).toBe('language=fr&theme=light');
        // Read once
        expect(sessionStorage.getItem(PREFERENCES_KEY)).toBeNull();
        expect(takeKeycloakSsoPreferencesQuery()).toBe('');
    });

    it.each([
        ['nothing kept', null, ''],
        ['an unreadable value', '{not json', ''],
        ['null', 'null', ''],
        ['values the app does not offer', JSON.stringify({ language: 'de', theme: 'sepia' }), ''],
        ['one value of two', JSON.stringify({ language: 'en', theme: 42 }), 'language=en'],
    ])('sends only what the app offers, with %s', (_case, stored, query) => {
        if (stored !== null) sessionStorage.setItem(PREFERENCES_KEY, stored);

        expect(takeKeycloakSsoPreferencesQuery()).toBe(query);
    });
});
