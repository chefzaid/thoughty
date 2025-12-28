import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

            // Since we mocked the API to return 1 page, we mainly check if input works without crashing
            // In a real scenario we'd mock multiple pages to verify page switch
            expect(pageInput.value).toBe('1');
        });
    });


    describe('Settings modal', () => {
        it('opens settings modal when settings button is clicked', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Settings')).toBeInTheDocument();
            });

            await user.click(screen.getByTitle('Settings'));

            await waitFor(() => {
                // Look for the Settings heading in the modal
                expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
            });
        });

        it('closes settings modal on cancel', async () => {
            const user = userEvent.setup();
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTitle('Settings')).toBeInTheDocument();
            });

            await user.click(screen.getByTitle('Settings'));

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Cancel'));

            await waitFor(() => {
                // Modal should be closed - Settings heading should not be visible
                expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
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
            mockFetch.mockImplementation((url) => {
                if (url === '/api/config') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ ...mockConfig, theme: 'light' })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockEntriesResponse)
                });
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

    describe('Error handling', () => {
        it('handles fetch error gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            mockFetch.mockRejectedValue(new Error('Network error'));

            render(<App />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalled();
            });

            consoleSpy.mockRestore();
        });
    });
    describe('Back to Top', () => {
        it('scrolls to top when clicked', async () => {
            const user = userEvent.setup();
            const scrollToMock = vi.fn();
            global.window.scrollTo = scrollToMock;

            render(<App />);

            await waitFor(() => {
                expect(screen.getByText('Back to top')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Back to top'));

            expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        });
    });
});

