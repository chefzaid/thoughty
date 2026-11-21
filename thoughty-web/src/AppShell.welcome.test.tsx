import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  createJsonResponse,
  mockConfig,
  mockFetch,
  renderAppShell,
  resetAppTestHarness,
  setDefaultMockFetch,
} from './test/appTestHarness';

/** The API answers with the welcome page done (`'true'`) or not yet (`'false'`, a new account). */
function serveOnboarding(onboardingDone: string) {
  setDefaultMockFetch((url, options) => {
    if (url === '/api/config' && options?.method !== 'POST') return createJsonResponse({ ...mockConfig, onboardingDone });
    return undefined;
  });
}

/** The body of each request sent to the URL with the method. */
function sentBodies(url: string, method: string): unknown[] {
  return mockFetch.mock.calls
    .filter(([input, options]) => input === url && (options as RequestInit | undefined)?.method === method)
    .map(([, options]) => JSON.parse(String((options as RequestInit).body)));
}

describe('AppShell welcome page', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('lands a new account on the welcome page, then opens the memoir start page and marks it done', async () => {
    const user = userEvent.setup();
    serveOnboarding('false');
    globalThis.history.replaceState({}, '', '/login');

    renderAppShell();

    await waitFor(() => expect(globalThis.location.pathname).toBe('/welcome'));
    await user.click(await screen.findByRole('button', { name: /My life story/ }));

    await waitFor(() => expect(globalThis.location.pathname).toBe('/memoir'));
    expect(sentBodies('/api/config', 'POST')).toContainEqual(expect.objectContaining({ onboardingDone: true }));
  });

  it('gives the default diary the first template picked and opens the journal', async () => {
    const user = userEvent.setup();
    serveOnboarding('false');
    globalThis.history.replaceState({}, '', '/login');

    renderAppShell();

    await user.click(await screen.findByRole('button', { name: /A daily journal/ }));
    expect(screen.getByText(/A new entry in My Diary starts from it/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Gratitude journal/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));

    await waitFor(() => expect(globalThis.location.pathname).toBe('/journal'));
    expect(globalThis.location.search).toBe('?diary=1');
    expect(sentBodies('/api/diaries/1', 'PUT')).toEqual([expect.objectContaining({ name: 'My Diary', defaultTemplateId: 'builtin-gratitude' })]);
    expect(sentBodies('/api/config', 'POST')).toContainEqual(expect.objectContaining({ onboardingDone: true }));
  });

  it('lands an account that has done it in the journal', async () => {
    serveOnboarding('true');
    globalThis.history.replaceState({}, '', '/login');

    renderAppShell();

    await waitFor(() => expect(globalThis.location.pathname).toBe('/journal'));
  });
});
