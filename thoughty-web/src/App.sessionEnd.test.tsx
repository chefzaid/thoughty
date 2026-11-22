import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  createJsonResponse,
  mockConfig,
  mockEntriesResponse,
  renderApp,
  resetAppTestHarness,
  setDefaultMockFetch,
  setMockAuthState,
} from './test/appTestHarness';
// After the harness, which stands in for the session
import App from './App';

const BO = { id: 'bo-id', username: 'Bo', email: 'bo@example.com' };

/** Ada's journal is light; Bo's has one entry of his own. */
function serveWriter(writer: 'ada' | 'bo') {
  setDefaultMockFetch((url) => {
    if (url === '/api/config') {
      return createJsonResponse(writer === 'ada' ? { ...mockConfig, name: 'Ada', theme: 'light' } : { ...mockConfig, name: 'Bo' });
    }
    if (writer === 'bo' && url.includes('/api/entries') && !url.includes('/by-date') && !url.includes('/first')) {
      return createJsonResponse({
        ...mockEntriesResponse,
        entries: [{ id: 9, date: '2024-02-01', index: 1, content: 'Bo’s own entry', tags: [] }],
        total: 1,
        allTags: [],
      });
    }
    return undefined;
  });
}

describe('App › a session that ends', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('drops the writer’s cache, theme and composer text, so the next writer sees none of it', async () => {
    serveWriter('ada');
    const user = userEvent.setup();
    const view = renderApp();
    await waitFor(() => expect(screen.getByText('Test entry 1')).toBeInTheDocument());
    await waitFor(() => expect(document.body).toHaveClass('light-mode'));
    await user.type(screen.getByPlaceholderText("What's on your mind?"), 'Ada’s half-written thought');

    // Ada signs out: the session key moves on
    setMockAuthState({ user: null, isAuthenticated: false, sessionKey: 1 });
    view.rerender(<App />);

    // The presentation page, then Sign In, in the signed-out look
    await waitFor(() => expect(globalThis.location.pathname).toBe('/'));
    expect(document.body).toHaveClass('dark-mode');
    expect(document.body).not.toHaveClass('light-mode');
    expect(screen.queryByText('Test entry 1')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Sign In' })[0] as HTMLElement);
    await waitFor(() => expect(document.querySelector('.auth-page')).toHaveClass('dark'));
    expect(document.body).not.toHaveClass('light-mode');

    // Bo signs in on the same page
    serveWriter('bo');
    setMockAuthState({ user: BO, isAuthenticated: true, sessionKey: 1 });
    view.rerender(<App />);

    await waitFor(() => expect(screen.getByText('Bo’s own entry')).toBeInTheDocument());
    expect(screen.queryByText('Test entry 1')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("What's on your mind?")).toHaveValue('');
    expect(document.body).toHaveClass('dark-mode');
  });
});
