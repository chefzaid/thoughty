import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { cleanupAppTestHarness, renderApp, resetAppTestHarness } from './test/appTestHarness';

describe('App entrypoint', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('mounts the router and renders the presentation page from the root path for signed-in users', async () => {
    globalThis.history.replaceState({}, '', '/');
    const user = userEvent.setup();

    renderApp();

    expect(globalThis.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Open your journal' })[0] as HTMLElement);

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/journal');
      expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    });
  });

  it('provides the query client and loads entries', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Test entry 1')).toBeInTheDocument();
      expect(screen.getByText('Test entry 2')).toBeInTheDocument();
    });
  });

  it('keeps the app shell reachable through the entrypoint', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    });
  });
});
