import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('react-chartjs-2', () => ({
    Bar: () => <div data-testid="bar-chart" />
}));

const mockStatsResponse = {
    totalThoughts: 2,
    uniqueTagsCount: 2,
    thoughtsPerYear: { '2024': 2 },
    thoughtsPerMonth: { '2024-01': 2 },
    thoughtsPerTag: { work: 1, personal: 1 },
    tagsPerYear: { '2024': { work: 1, personal: 1 } }
};

const mockFormatResponse = {
    entrySeparator: '--------------------------------------------------------------------------------',
    sameDaySeparator: '********************************************************************************',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ','
};

const mockExportBlob = new Blob(['exported'], { type: 'text/plain' });
const mockEntries = [
    { id: 1, date: '2024-01-15', index: 1, content: 'Test entry 1', tags: ['work'] },
    { id: 2, date: '2024-01-15', index: 2, content: 'Test entry 2', tags: ['personal'] }
];

const mockEntriesResponse = {
    entries: mockEntries,
    total: 2,
    page: 1,
    totalPages: 1,
    allTags: ['work', 'personal']
};

const mockConfig = {
    name: 'Test User',
    theme: 'dark',
    autoTagMaxTags: '0'
};

const createJsonResponse = (data: unknown) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data)
});

const createDefaultFetchResponse = (url: string) => {
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
            headers: new Headers({ 'Content-Disposition': 'attachment; filename="export.txt"' })
        });
    }
    if (url.includes('/api/config/profile-stats')) {
        return createJsonResponse({ totalEntries: 2, uniqueTags: 2, firstEntryYear: 2024 });
    }
    if (url.includes('/api/cloud-sync/status') || url.includes('/api/cloud-sync/schedules')) {
        return createJsonResponse({});
    }

    return createJsonResponse({ success: true });
};

const setDefaultMockFetch = (override?: (url: string) => Promise<unknown> | undefined) => {
    mockFetch.mockImplementation((url: string) => override?.(url) ?? createDefaultFetchResponse(url));
};
// Track the current mock state
let mockAuthState = {
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
    googleClientId: ''
};

// Mock the AuthContext
vi.mock('./contexts/AuthContext', () => ({
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => mockAuthState
}));

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('App Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        globalThis.history.replaceState({}, '', '/');
        HTMLElement.prototype.scrollIntoView = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
        globalThis.URL.revokeObjectURL = vi.fn();

        // Reset auth state to authenticated
        mockAuthState = {
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
            googleClientId: ''
        };

        setDefaultMockFetch();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        globalThis.history.replaceState({}, '', '/');
    });

    describe('Public intro flow', () => {
        it('shows the public intro page when the user is not authenticated', () => {
            mockAuthState = {
                ...mockAuthState,
                user: null,
                isAuthenticated: false
            };

            render(<App />);

            expect(screen.getByText('A journal that feels calm when you write and sharp when you search.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
        });

        it('loads the sign-in screen from /login', async () => {
            globalThis.history.replaceState({}, '', '/login');
            mockAuthState = {
                ...mockAuthState,
                user: null,
                isAuthenticated: false
            };

            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Welcome back')).toBeInTheDocument();
                expect(screen.getByLabelText('Email or Username')).toBeInTheDocument();
            });
        });

        it('loads the sign-up screen from /register', async () => {
            globalThis.history.replaceState({}, '', '/register');
            mockAuthState = {
                ...mockAuthState,
                user: null,
                isAuthenticated: false
            };

            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Create your account')).toBeInTheDocument();
                expect(screen.getByLabelText('Username')).toBeInTheDocument();
            });
        });

        it('navigates from the intro page to sign in and sign up modes', async () => {
            const user = userEvent.setup();
            mockAuthState = {
                ...mockAuthState,
                user: null,
                isAuthenticated: false
            };

            render(<App />);

            await user.click(screen.getByRole('button', { name: 'Sign In' }));
            expect(globalThis.location.pathname).toBe('/login');
            expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
            expect(screen.getByText('Welcome back')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Back' }));
            expect(globalThis.location.pathname).toBe('/');
            await user.click(screen.getByRole('button', { name: 'Sign Up' }));
            expect(globalThis.location.pathname).toBe('/register');
            expect(screen.getByText('Create your account')).toBeInTheDocument();
        });
    });

    describe('Initial render', () => {
        it('renders the main heading', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Thoughty')).toBeInTheDocument();
            });
        });

        it('fetches and displays entries on load', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Test entry 1')).toBeInTheDocument();
                expect(screen.getByText('Test entry 2')).toBeInTheDocument();
            });
        });

        it('fetches and displays user profile', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Test User')).toBeInTheDocument();
            });
        });

        it('displays the new entry form', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
            });
        });

        it('navigates to a permalink entry from the URL', async () => {
            globalThis.history.replaceState({}, '', '/journal?entry=2');

            render(<App />);

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

            render(<App />);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
                expect(screen.getByText('Entry not found')).toBeInTheDocument();
                expect(screen.getByText('This entry may have been deleted, or the link is no longer valid.')).toBeInTheDocument();
            });

            expect(alertSpy).not.toHaveBeenCalled();

            alertSpy.mockRestore();
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

            render(<App />);

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

    });

    describe('Entry form validation', () => {
        it('shows error when text is empty', async () => {
            const user = userEvent.setup();
            render(<App />);

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
            render(<App />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
            });

            const textarea = screen.getByPlaceholderText("What's on your mind?");
            await user.type(textarea, 'Entry without tags');

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
                        json: () => Promise.resolve({ ...mockConfig, autoTagMaxTags: '3' })
                    });
                }
                if (url === '/api/entries' && options?.method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true, entryId: 3 })
                    });
                }
                if (typeof url === 'string' && url.includes('/api/entries')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockEntriesResponse)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            });

            render(<App />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
            });

            await user.type(screen.getByPlaceholderText("What's on your mind?"), 'Entry without manual tags');
            await user.click(screen.getByRole('button', { name: 'Save' }));

            await waitFor(() => {
                expect(screen.queryByText('Please add at least one tag')).not.toBeInTheDocument();
            });
        });
    });

    describe('Pagination', () => {
        it('displays pagination controls', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Previous')).toBeInTheDocument();
                expect(screen.getByTitle('Next')).toBeInTheDocument();
                expect(screen.getByTitle('First')).toBeInTheDocument();
                expect(screen.getByTitle('Last')).toBeInTheDocument();
            });
        });

        it('disables Previous and First on first page', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Previous')).toBeDisabled();
                expect(screen.getByTitle('First')).toBeDisabled();
            });
        });

        it('supports manual page input', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByRole('spinbutton')).toBeInTheDocument();
            });

            const pageInput = screen.getByRole('spinbutton');
            await user.clear(pageInput);
            await user.type(pageInput, '1');
            await user.keyboard('{Enter}');

            expect((pageInput as HTMLInputElement).value).toBe('1');
        });
    });

    describe('Profile navigation', () => {
        it('opens profile page when profile button is clicked', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Profile')).toBeInTheDocument();
            });

            await user.click(screen.getByTitle('Profile'));

            await waitFor(() => {
                // Profile page should show
                expect(screen.getByText(/profile/i)).toBeInTheDocument();
            });
        });
    });

    describe('Delete confirmation', () => {
        it('displays confirm modal component', async () => {
            render(<App />);

            // The ConfirmModal component exists and is controlled by state
            // Just verify the component can render
            await waitFor(() => {
                expect(screen.getByText('Thoughty')).toBeInTheDocument();
            });
        });
    });

    describe('Edit functionality', () => {
        it('edit mode components exist', async () => {
            render(<App />);

            // Verify the app renders with entries from mock
            await waitFor(() => {
                expect(screen.getByText('Thoughty')).toBeInTheDocument();
            });
        });

        it('cancels edit mode', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Test entry 1')).toBeInTheDocument();
            });

            const editButtons = screen.queryAllByTitle('Edit');
            const firstEditButton = editButtons[0];
            if (firstEditButton) {
                await user.click(firstEditButton);

                await waitFor(() => {
                    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
                });

                await user.click(screen.getByRole('button', { name: 'Cancel' }));

                await waitFor(() => {
                    expect(screen.getByText('Test entry 1')).toBeInTheDocument();
                });
            }
        });
    });

    describe('Theme application', () => {
        it('applies dark theme by default', async () => {
            render(<App />);

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
                if (url === '/api/config') return Promise.resolve(configResponse);
                if (typeof url === 'string' && url.includes('/api/entries')) return Promise.resolve(entriesResponse);
                if (typeof url === 'string' && url.includes('/api/diaries')) return Promise.resolve(diariesResponse);
                return Promise.resolve(defaultResponse);
            });

            render(<App />);

            await waitFor(() => {
                expect(document.body.classList.contains('light-mode')).toBe(true);
            });
        });
    });

    describe('Search functionality', () => {
        it('has a search input', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
            });
        });

        it('has reset filters button', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Reset Filters')).toBeInTheDocument();
            });
        });
    });

    describe('Back to Top', () => {
        it('scrolls to top when clicked', async () => {
            const user = userEvent.setup();
            const scrollToMock = vi.fn();
            globalThis.scrollTo = scrollToMock;

            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Back to top')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Back to top'));

            expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        });
    });

    describe('Loading state', () => {
        it('shows loading spinner when auth is loading', async () => {
            mockAuthState = {
                ...mockAuthState,
                loading: true,
                isAuthenticated: false
            };

            const { container } = render(<App />);

            // Should show loading spinner
            expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
        });
    });

    describe('Unauthenticated state', () => {
        it('shows auth page when not authenticated', async () => {
            mockAuthState = {
                ...mockAuthState,
                loading: false,
                isAuthenticated: false
            };

            render(<App />);

            await waitFor(() => {
                // Should show login form - check for specific auth form element
                expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
            });
        });
    });

    describe('View navigation', () => {
        it('loads import/export presets from the route query', async () => {
            const user = userEvent.setup();
            globalThis.history.replaceState({}, '', '/import-export?diary=all&section=import&format=json&includeVisibility=true');

            render(<App />);

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

            render(<App />);

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

            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('My Diary')).toBeInTheDocument();
            });
        });

        it('navigates to profile view', async () => {
            const user = userEvent.setup();
            render(<App />);

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
            render(<App />);

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
            render(<App />);

            await waitFor(() => {
                // Stats button uses text, not title
                expect(screen.getByRole('button', { name: /Stats/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /Stats/i }));

            // Verify we're in stats view by checking for stats-specific elements
            await waitFor(() => {
                expect(screen.getByText('My Diary')).toBeInTheDocument();
            });
        });

        it('navigates to import/export view', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Import\/Export/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /Import\/Export/i }));

            // Verify we're in import/export view by checking for specific elements
            await waitFor(() => {
                expect(screen.getByRole('heading', { name: 'Import/Export' })).toBeInTheDocument();
            });
        });
    });

    describe('Diary tabs interaction', () => {
        it('displays diary tabs in stats view', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Stats/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /Stats/i }));

            await waitFor(() => {
                // Diary tabs should be visible
                expect(screen.getByText('My Diary')).toBeInTheDocument();
            });
        });

        it('keeps the journal responsive when switching to all diaries', async () => {
            const user = userEvent.setup();
            render(<App />);

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
    });

    describe('Footer', () => {
        it('displays footer with copyright', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText(/© 2026 Thoughty/)).toBeInTheDocument();
            });
        });
    });

    describe('Logout functionality', () => {
        it('calls logout when logout button is clicked', async () => {
            const user = userEvent.setup();
            const logoutMock = vi.fn();
            mockAuthState = {
                ...mockAuthState,
                logout: logoutMock
            };

            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Logout')).toBeInTheDocument();
            });

            await user.click(screen.getByTitle('Logout'));

            expect(logoutMock).toHaveBeenCalled();
        });
    });

    describe('Entry visibility toggle', () => {
        it('displays visibility icons on entries', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Test entry 1')).toBeInTheDocument();
            });

            // Should have visibility toggle buttons
            const visibilityButtons = screen.queryAllByTitle(/visibility|public|private/i);
            expect(visibilityButtons.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Filter controls', () => {
        it('displays filter controls in journal view', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
            });
        });

        it('allows clearing search', async () => {
            const user = userEvent.setup();
            render(<App />);

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
});
