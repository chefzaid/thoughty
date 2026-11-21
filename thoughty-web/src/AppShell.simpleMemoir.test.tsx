import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { memoirOverview } from './test/memoirFixture';
import {
  cleanupAppTestHarness,
  createJsonResponse,
  mockConfig,
  renderAppShell,
  resetAppTestHarness,
  setDefaultMockFetch,
} from './test/appTestHarness';

/** The API answers with simple memoir mode on (`'true'`) or off, and a memoir asking its first question. */
function serveSimpleMode(memoirSimpleMode: string, theme = 'dark') {
  setDefaultMockFetch((url) => {
    if (url === '/api/config') return createJsonResponse({ ...mockConfig, theme, memoirSimpleMode });
    if (url === '/api/memoir') return createJsonResponse(memoirOverview());
    return undefined;
  });
}

describe('AppShell simple memoir mode', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('lands a signed-in writer on the simple memoir screen, without the menu or footer', async () => {
    serveSimpleMode('true');
    globalThis.history.replaceState({}, '', '/login');

    renderAppShell();

    await waitFor(() => expect(globalThis.location.pathname).toBe('/memoir/simple'));
    expect(await screen.findByRole('heading', { level: 1, name: 'What was home like?' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('lands in the journal while simple mode is off', async () => {
    serveSimpleMode('false');
    globalThis.history.replaceState({}, '', '/login');

    renderAppShell();

    await waitFor(() => expect(globalThis.location.pathname).toBe('/journal'));
  });

  it('opens the simple screen from the presentation page in simple mode', async () => {
    const user = userEvent.setup();
    serveSimpleMode('true', 'light');
    globalThis.history.replaceState({}, '', '/');

    const { container } = renderAppShell();
    // The light theme shows the settings are read; the button then goes where signing in lands
    await waitFor(() => expect(container.querySelector('.intro-page.light')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Open your journal' })[0]!);
    expect(globalThis.location.pathname).toBe('/memoir/simple');
  });
});
