import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the AuthContext
vi.mock('./contexts/AuthContext', () => ({
    AuthProvider: ({ children }) => children,
    useAuth: () => ({
        user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
        isAuthenticated: true,
        loading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        authFetch: vi.fn(),
        getAccessToken: () => 'mock-token'
    })
}));

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('App Integration Tests', () => {
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
        theme: 'dark'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default mock responses
        mockFetch.mockImplementation((url) => {
            if (url === '/api/config') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockConfig)
                });
            }
            if (typeof url === 'string' && url.includes('/api/entries')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockEntriesResponse)
                });
            }
            if (typeof url === 'string' && url.includes('/api/diaries')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
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

            expect(pageInput.value).toBe('1');
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
        it('opens delete confirmation modal', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getAllByTitle('Delete').length).toBeGreaterThan(0);
            });

            await user.click(screen.getAllByTitle('Delete')[0]);

            await waitFor(() => {
                expect(screen.getByText('Delete Entry')).toBeInTheDocument();
                expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
            });
        });
    });

    describe('Edit functionality', () => {
        it('opens edit mode when edit button is clicked', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getAllByTitle('Edit').length).toBeGreaterThan(0);
            });

            await user.click(screen.getAllByTitle('Edit')[0]);

            await waitFor(() => {
                expect(screen.getByDisplayValue('Test entry 1')).toBeInTheDocument();
            });
        });

        it('cancels edit mode', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getAllByTitle('Edit').length).toBeGreaterThan(0);
            });

            await user.click(screen.getAllByTitle('Edit')[0]);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            await waitFor(() => {
                expect(screen.getByText('Test entry 1')).toBeInTheDocument();
            });
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

            mockFetch.mockImplementation((url) => {
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
});

