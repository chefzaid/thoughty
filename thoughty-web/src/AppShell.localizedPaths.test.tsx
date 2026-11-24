import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  createJsonResponse,
  mockConfig,
  renderAppShell,
  resetAppTestHarness,
  setDefaultMockFetch,
  setMockAuthState,
} from './test/appTestHarness';
import { stubBrowserLanguages } from './test/systemScheme';
import { getTranslation } from './utils/translations';

const fr = (key: string) => getTranslation('fr', key);
const en = (key: string) => getTranslation('en', key);

const INTRO_TITLE = { en: 'A private journal that becomes your life story.', fr: 'Un journal privé qui devient l’histoire de votre vie.' };

const alternates = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]')]
  .map((link) => `${link.hreflang} ${new URL(link.href).pathname}`);

describe('AppShell localized public pages', () => {
  beforeEach(() => {
    resetAppTestHarness();
    stubBrowserLanguages(['en-US']);
  });
  afterEach(cleanupAppTestHarness);

  it('reads a page under /fr/ in French in an English browser, its links leading on in French', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/fr/about');
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();

    expect(await screen.findByRole('heading', { name: fr('aboutTitle') })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    expect(new URL(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '').pathname).toBe('/fr/about');
    expect(alternates()).toEqual(['en /about', 'fr /fr/about', 'x-default /about']);
    expect(screen.getByRole('link', { name: fr('footerMemoirQuestions') })).toHaveAttribute('href', '/fr/memoir-questions');
    expect(within(screen.getByRole('group', { name: fr('visitorPreferencesLabel') })).getByRole('button', { name: 'Français' }))
      .toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: fr('back') }));
    expect(globalThis.location.pathname).toBe('/fr/');
    expect(screen.getByRole('heading', { level: 1, name: INTRO_TITLE.fr })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: fr('landingNavBlog') })).toHaveAttribute('href', '/fr/blog');

    // The sign-in page, which has no language in its path, goes on in the language read
    await user.click(screen.getAllByRole('button', { name: fr('signIn') })[0] as HTMLElement);
    expect(globalThis.location.pathname).toBe('/login');
    expect(await screen.findByText(fr('welcomeBack'))).toBeInTheDocument();
  });

  it('sends a French browser from the English address to the French one', async () => {
    stubBrowserLanguages(['fr-FR']);
    globalThis.history.replaceState({}, '', '/blog?from=mail');
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();

    expect(await screen.findByRole('heading', { name: fr('blogTitle') })).toBeInTheDocument();
    expect(globalThis.location.pathname + globalThis.location.search).toBe('/fr/blog?from=mail');
  });

  it('opens the page’s other address from the visitor switch, which stays picked', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/privacy');
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();

    expect(await screen.findByRole('heading', { name: en('privacyTitle') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Français' }));
    expect(globalThis.location.pathname).toBe('/fr/privacy');
    expect(await screen.findByRole('heading', { name: fr('privacyTitle') })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(globalThis.location.pathname).toBe('/privacy');
    expect(await screen.findByRole('heading', { name: en('privacyTitle') })).toBeInTheDocument();
    expect(localStorage.getItem('thoughty.visitorLanguage')).toBe('en');
  });

  it('shows a signed-in writer the language of the path, sending a French writer to the French address', async () => {
    globalThis.history.replaceState({}, '', '/fr/about');
    setMockAuthState({ isAuthenticated: true });
    const english = renderAppShell();
    expect(await screen.findByRole('heading', { name: fr('aboutTitle') })).toBeInTheDocument();
    english.unmount();

    setDefaultMockFetch((url) => (url === '/api/config' ? createJsonResponse({ ...mockConfig, language: 'fr' }) : undefined));
    globalThis.history.replaceState({}, '', '/about');
    const { unmount } = renderAppShell();
    expect(await screen.findByRole('heading', { name: fr('aboutTitle') })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe('/fr/about');
    unmount();

    globalThis.history.replaceState({}, '', '/journal');
    renderAppShell();
    expect(await screen.findByRole('link', { name: fr('footerMemoirQuestions') })).toHaveAttribute('href', '/fr/memoir-questions');
  });

  it('leaves the sign-in pages out of the French addresses', async () => {
    globalThis.history.replaceState({}, '', '/fr/login');
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();

    expect(await screen.findByRole('heading', { level: 1, name: INTRO_TITLE.en })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe('/');
  });
});
