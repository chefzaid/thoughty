import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

import App from '../App';
import AppShell from '../AppShell';
import { createTestQueryClient } from './queryClient';

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />,
}));

export interface MockAuthState {
  user: { id: string; username: string; email: string; avatarUrl?: string } | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  signInWithGoogle: ReturnType<typeof vi.fn>;
  forgotPassword: ReturnType<typeof vi.fn>;
  changePassword: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
  deleteAccount: ReturnType<typeof vi.fn>;
  authFetch: ReturnType<typeof vi.fn>;
  getAccessToken: () => string;
  googleClientId: string;
}

export const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function createMockAuthState(overrides: Partial<MockAuthState> = {}): MockAuthState {
  const defaultState: MockAuthState = {
    user: { id: 'test-user-id', username: 'TestUser', email: 'test@example.com' },
    isAuthenticated: true,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    signInWithGoogle: vi.fn(),
    forgotPassword: vi.fn(),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
    deleteAccount: vi.fn(),
    authFetch: vi.fn((input: string | URL | Request, init?: RequestInit) => mockFetch(input, init)),
    getAccessToken: () => 'mock-token',
    googleClientId: '',
  };

  return {
    ...defaultState,
    ...overrides,
    authFetch: overrides.authFetch ?? defaultState.authFetch,
  };
}

let mockAuthState = createMockAuthState();

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => mockAuthState,
}));

export const mockStatsResponse = {
  totalThoughts: 2,
  uniqueTagsCount: 2,
  thoughtsPerYear: { '2024': 2 },
  thoughtsPerMonth: { '2024-01': 2 },
  thoughtsPerDay: { '2024-01-15': 1, '2024-01-16': 1 },
  thoughtsPerTag: { work: 1, personal: 1 },
  tagsPerYear: { '2024': { work: 1, personal: 1 } },
  tagsPerMonth: {},
  toneMoodAnalysis: {
    dominantMood: 'reflective',
    dominantTone: 'candid',
    moodBreakdown: { reflective: 1, calm: 1 },
    toneBreakdown: { candid: 2 },
    analyzedEntries: 2,
    summary: 'Recent entries feel reflective and candid.',
  },
};

export const mockFormatResponse = {
  entrySeparator: '--------------------------------------------------------------------------------',
  sameDaySeparator: '********************************************************************************',
  datePrefix: '---',
  dateSuffix: '--',
  dateFormat: 'YYYY-MM-DD',
  tagOpenBracket: '[',
  tagCloseBracket: ']',
  tagSeparator: ',',
};

export const mockExportBlob = new Blob(['exported'], { type: 'text/plain' });
export const mockEntries = [
  { id: 1, date: '2024-01-15', index: 1, content: 'Test entry 1', tags: ['work'] },
  { id: 2, date: '2024-01-15', index: 2, content: 'Test entry 2', tags: ['personal'] },
];

export const mockEntriesResponse = {
  entries: mockEntries,
  total: 2,
  page: 1,
  totalPages: 1,
  allTags: ['work', 'personal'],
};

export const mockConfig = {
  name: 'Test User',
  theme: 'dark',
  highContrast: false,
  autoTagMaxTags: '0',
};

export function createJsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

export function createDefaultFetchResponse(url: string) {
  if (url === '/api/config') {
    return createJsonResponse(mockConfig);
  }
  if (url.includes('/api/entries/by-date')) {
    return createJsonResponse({ found: true, page: 1, entryId: 2 });
  }
  if (url.includes('/api/entries/first')) {
    return createJsonResponse({ years: [2024], months: ['2024-01'] });
  }
  if (url.includes('/api/entries')) {
    return createJsonResponse(mockEntriesResponse);
  }
  if (url.includes('/api/diaries')) {
    return createJsonResponse([{ id: 1, name: 'My Diary', is_default: true }]);
  }
  if (url.includes('/api/stats')) {
    return createJsonResponse(mockStatsResponse);
  }
  if (url.includes('/api/io/format')) {
    return createJsonResponse(mockFormatResponse);
  }
  if (url.includes('/api/io/export')) {
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(mockExportBlob),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.txt"' }),
    });
  }
  if (url.includes('/api/config/profile-stats')) {
    return createJsonResponse({ totalEntries: 2, uniqueTags: 2, firstEntryYear: 2024 });
  }
  if (url.includes('/api/cloud-sync/status') || url.includes('/api/cloud-sync/schedules')) {
    return createJsonResponse({});
  }

  return createJsonResponse({ success: true });
}

export function setDefaultMockFetch(
  override?: (url: string, options?: RequestInit) => Promise<unknown> | undefined,
) {
  mockFetch.mockImplementation((input: string | URL | Request, options?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    return override?.(url, options) ?? createDefaultFetchResponse(url);
  });
}

export function setMockAuthState(overrides: Partial<MockAuthState>) {
  mockAuthState = createMockAuthState(overrides);
}

export function resetAppTestHarness() {
  vi.clearAllMocks();
  localStorage.clear();
  globalThis.history.replaceState({}, '', '/');
  document.body.classList.remove('light-mode', 'dark-mode');
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockAuthState = createMockAuthState();
  setDefaultMockFetch();
}

export function cleanupAppTestHarness() {
  vi.restoreAllMocks();
  localStorage.clear();
  globalThis.history.replaceState({}, '', '/');
  document.body.classList.remove('light-mode', 'dark-mode');
}

export function renderApp() {
  return render(<App />);
}

export function renderAppShell() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
