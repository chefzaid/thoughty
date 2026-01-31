import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThoughtOfTheDay from './ThoughtOfTheDay';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

vi.mock('../EntryContentRenderer/EntryContentRenderer', () => ({
    default: ({ content }) => <div data-testid="entry-content">{content}</div>
}));

const mockT = (key) => key;

describe('ThoughtOfTheDay', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when closed', () => {
        render(<ThoughtOfTheDay isOpen={false} onClose={vi.fn()} theme="dark" t={mockT} />);
        expect(screen.queryByText('highlightsTitle')).not.toBeInTheDocument();
    });

    it('renders highlights when open', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                randomEntry: {
                    id: 1,
                    date: '2024-01-01',
                    content: 'Hello',
                    diary_name: 'Personal',
                    diary_icon: '📓',
                    tags: ['tag1'],
                    index: 0
                },
                onThisDay: {
                    '1': [
                        { id: 2, date: '2023-01-01', content: 'Past', diary_name: 'Work', diary_icon: '💼', index: 1 }
                    ]
                }
            })
        });

        render(<ThoughtOfTheDay isOpen={true} onClose={vi.fn()} theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('randomThought')).toBeInTheDocument();
            expect(screen.getByText('onThisDay')).toBeInTheDocument();
            expect(screen.getByText('Hello')).toBeInTheDocument();
        });
    });

    it('shows empty state when no highlights', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ randomEntry: null, onThisDay: {} })
        });

        render(<ThoughtOfTheDay isOpen={true} onClose={vi.fn()} theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('noHighlights')).toBeInTheDocument();
        });
    });

    it('handles fetch error', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: false });

        render(<ThoughtOfTheDay isOpen={true} onClose={vi.fn()} theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByText('highlightsError')).toBeInTheDocument();
        });
    });

    it('refreshes highlights', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ randomEntry: null, onThisDay: {} }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ randomEntry: null, onThisDay: {} }) });

        render(<ThoughtOfTheDay isOpen={true} onClose={vi.fn()} theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(screen.getByTitle('refreshRandom')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle('refreshRandom'));

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });
    });

    it('calls onClose on overlay click and Escape', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ randomEntry: null, onThisDay: {} }) });
        const onClose = vi.fn();

        const { container } = render(<ThoughtOfTheDay isOpen={true} onClose={onClose} theme="dark" t={mockT} />);

        await waitFor(() => {
            expect(container.querySelector('.thought-of-day-overlay')).toBeTruthy();
        });

        fireEvent.click(container.querySelector('.thought-of-day-overlay'));
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();
    });

    it('navigates to entry on click', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                randomEntry: {
                    id: 1,
                    date: '2024-01-01T00:00:00.000Z',
                    content: 'Hello',
                    diary_name: 'Personal',
                    diary_icon: '📓',
                    tags: [],
                    index: 3
                },
                onThisDay: {}
            })
        });

        const onClose = vi.fn();
        const onNavigateToEntry = vi.fn();
        render(
            <ThoughtOfTheDay
                isOpen={true}
                onClose={onClose}
                onNavigateToEntry={onNavigateToEntry}
                theme="dark"
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Hello')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Hello'));

        expect(onNavigateToEntry).toHaveBeenCalledWith('2024-01-01', 3);
        expect(onClose).toHaveBeenCalled();
    });
});
