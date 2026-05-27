import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  createJsonResponse,
  mockFetch,
  renderAppShell,
  resetAppTestHarness,
  setDefaultMockFetch,
  setMockAuthState,
} from './test/appTestHarness';

describe('AppShell navigation flows', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('navigates to a permalink entry from the URL', async () => {
    globalThis.history.replaceState({}, '', '/journal?entry=2');

    renderAppShell();

    await waitFor(() => {
      expect(mockFetch.mock.calls.some((call) => call[0] === '/api/entries/by-date?id=2&limit=10')).toBe(true);
    });
  });

  it('shows a toast instead of a browser alert when a permalink target is missing', async () => {
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

    globalThis.history.replaceState({}, '', '/journal?entry=999');
    setDefaultMockFetch((url) => {
      if (url.includes('/api/entries/by-date?id=999&limit=10')) {
        return createJsonResponse({ found: false });
      }

      return undefined;
    });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Entry not found')).toBeInTheDocument();
      expect(screen.getByText('This entry may have been deleted, or the link is no longer valid.')).toBeInTheDocument();
    });

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('clears the active permalink when navigating through a cross-reference link', async () => {
    const user = userEvent.setup();

    globalThis.history.replaceState({}, '', '/journal?entry=2');
    setDefaultMockFetch((url) => {
      if (url.includes('/api/entries/by-date?id=2&limit=10')) {
        return createJsonResponse({ found: true, page: 1, entryId: 2 });
      }

      if (url.includes('/api/entries/by-date?date=2024-01-16&index=1&limit=10')) {
        return createJsonResponse({ found: true, page: 1, entryId: 3 });
      }

      if (url.includes('/api/entries?')) {
        return createJsonResponse({
          entries: [
            { id: 2, date: '2024-01-15', index: 2, content: 'See [[2024-01-16]]', tags: ['personal'] },
            { id: 3, date: '2024-01-16', index: 1, content: 'Target entry', tags: ['work'] },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
          allTags: ['personal', 'work'],
        });
      }

      return undefined;
    });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '[[2024-01-16]]' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '[[2024-01-16]]' }));

    await waitFor(() => {
      expect(mockFetch.mock.calls.some((call) => call[0] === '/api/entries/by-date?date=2024-01-16&index=1&limit=10')).toBe(true);
      expect(globalThis.location.search).not.toContain('entry=2');
      expect(document.getElementById('entry-3')).toHaveClass('highlight-entry');
    });
  });

  it('loads import/export presets from the route query', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/import-export?diary=all&section=import&format=json&includeVisibility=true');

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toHaveClass('primary');
    });

    expect((screen.getByLabelText('Include visibility') as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole('button', { name: /Download/i }));

    await waitFor(() => {
      const exportCall = mockFetch.mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/io/export'));
      expect(exportCall).toBeTruthy();
      expect((exportCall as [string])[0]).toContain('format=json');
      expect((exportCall as [string])[0]).toContain('includeVisibility=true');
      expect((exportCall as [string])[0]).not.toContain('diaryId=');
    });
  });

  it('returns to the originating view from diary management', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/stats?diary=1');

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Manage Diaries/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Manage Diaries/i }));

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/diaries');
      expect(globalThis.location.search).toContain('from=stats');
    });

    const diaryManagerBackButton = document.querySelector('.diary-manager-header .back-btn') as HTMLButtonElement | null;
    expect(diaryManagerBackButton).not.toBeNull();
    if (!diaryManagerBackButton) {
      throw new Error('Diary manager back button not found');
    }

    await user.click(diaryManagerBackButton);

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/stats');
      expect(globalThis.location.search).toContain('diary=1');
      expect(screen.getByText('My Diary')).toBeInTheDocument();
    });
  });

  it('loads the stats view from its direct path', async () => {
    globalThis.history.replaceState({}, '', '/stats');

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('My Diary')).toBeInTheDocument();
    });
  });

  it('navigates to profile view', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByTitle('Profile')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Profile'));

    await waitFor(() => {
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
    });
  });

  it('navigates to tags view', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Tags$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Tags$/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    });
  });

  it('navigates to stats view', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stats/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Stats/i }));

    await waitFor(() => {
      expect(screen.getByText('My Diary')).toBeInTheDocument();
    });
  });

  it('navigates to import/export view', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Import\/Export/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Import\/Export/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Import/Export' })).toBeInTheDocument();
    });
  });

  it('displays diary tabs in stats view', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stats/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Stats/i }));

    await waitFor(() => {
      expect(screen.getByText('My Diary')).toBeInTheDocument();
    });
  });

  it('keeps the journal responsive when switching to all diaries', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByTitle('All Diaries')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('All Diaries'));

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/journal');
      expect(globalThis.location.search).toContain('diary=all');
      expect(screen.getByTitle('All Diaries')).toHaveClass('active');
      expect(screen.getByRole('button', { name: /Stats/i })).toBeInTheDocument();
    });
  });

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn();
    setMockAuthState({ logout: logoutMock });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByTitle('Logout')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Logout'));

    expect(logoutMock).toHaveBeenCalled();
  });
});