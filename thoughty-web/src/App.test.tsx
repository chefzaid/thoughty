import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { cleanupAppTestHarness, renderApp, resetAppTestHarness } from './test/appTestHarness';

describe('App entrypoint', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('mounts the router and renders the authenticated shell from the root path', async () => {
    renderApp();

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/journal');
      expect(screen.getByText('Thoughty')).toBeInTheDocument();
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
