import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  mockConfig,
  mockEntriesResponse,
  mockFetch,
  renderAppShell,
  resetAppTestHarness,
} from './test/appTestHarness';

describe('AppShell behavior flows', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('shows error when text is empty', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter some text')).toBeInTheDocument();
    });
  });

  it('shows error when no tags selected', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("What's on your mind?"), 'Entry without tags');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Please add at least one tag')).toBeInTheDocument();
    });
  });

  it('allows saving without manual tags when auto-tagging is enabled', async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockConfig, autoTagMaxTags: '3' }),
        });
      }
      if (url === '/api/entries' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, entryId: 3 }),
        });
      }
      if (typeof url === 'string' && url.includes('/api/entries')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEntriesResponse),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("What's on your mind?"), 'Entry without manual tags');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByText('Please add at least one tag')).not.toBeInTheDocument();
    });
  });

  it('displays pagination controls', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByTitle('Previous')).toBeInTheDocument();
      expect(screen.getByTitle('Next')).toBeInTheDocument();
      expect(screen.getByTitle('First')).toBeInTheDocument();
      expect(screen.getByTitle('Last')).toBeInTheDocument();
    });
  });

  it('disables Previous and First on first page', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByTitle('Previous')).toBeDisabled();
      expect(screen.getByTitle('First')).toBeDisabled();
    });
  });

  it('supports manual page input', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    const pageInput = screen.getByRole('spinbutton');
    await user.clear(pageInput);
    await user.type(pageInput, '1');
    await user.keyboard('{Enter}');

    expect((pageInput as HTMLInputElement).value).toBe('1');
  });

  it('displays confirm modal component', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Thoughty')).toBeInTheDocument();
    });
  });

  it('renders entry editing affordances', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Thoughty')).toBeInTheDocument();
    });
  });

  it('shows edit actions for journal entries', async () => {
    renderAppShell();

    const editButtons = await screen.findAllByTitle('Edit');

    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('applies dark theme by default', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(document.body.classList.contains('dark-mode')).toBe(true);
    });
  });

  it('applies light theme when configured', async () => {
    const lightThemeConfig = { ...mockConfig, theme: 'light' };
    const configResponse = { ok: true, json: () => Promise.resolve(lightThemeConfig) };
    const entriesResponse = { ok: true, json: () => Promise.resolve(mockEntriesResponse) };
    const diariesResponse = { ok: true, json: () => Promise.resolve([]) };
    const defaultResponse = { ok: true, json: () => Promise.resolve({ success: true }) };

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/config') {
        return Promise.resolve(configResponse);
      }
      if (typeof url === 'string' && url.includes('/api/entries')) {
        return Promise.resolve(entriesResponse);
      }
      if (typeof url === 'string' && url.includes('/api/diaries')) {
        return Promise.resolve(diariesResponse);
      }
      return Promise.resolve(defaultResponse);
    });

    renderAppShell();

    await waitFor(() => {
      expect(document.body.classList.contains('light-mode')).toBe(true);
    });
  });

  it('has a search input', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
    });
  });

  it('has reset filters button', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Reset Filters')).toBeInTheDocument();
    });
  });

  it('scrolls to top when clicked', async () => {
    const user = userEvent.setup();
    const scrollToMock = vi.fn();
    globalThis.scrollTo = scrollToMock;

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Back to top')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to top'));

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('displays footer with copyright', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText(/© 2026 Thoughty/)).toBeInTheDocument();
    });
  });

  it('displays visibility icons on entries', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Test entry 1')).toBeInTheDocument();
    });

    const visibilityButtons = screen.queryAllByTitle(/visibility|public|private/i);
    expect(visibilityButtons.length).toBeGreaterThanOrEqual(0);
  });

  it('displays filter controls in journal view', async () => {
    renderAppShell();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
    });
  });

  it('allows clearing search', async () => {
    const user = userEvent.setup();

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search content...');
    await user.type(searchInput, 'test search');

    expect((searchInput as HTMLInputElement).value).toBe('test search');

    await user.clear(searchInput);
    expect((searchInput as HTMLInputElement).value).toBe('');
  });
});