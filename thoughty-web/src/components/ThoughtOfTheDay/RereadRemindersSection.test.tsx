import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import ThoughtOfTheDay from './ThoughtOfTheDay';

const service = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }));

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return { useAuth: () => ({ authFetch }) };
});

vi.mock('../EntryContentRenderer/EntryContentRenderer', () => ({
    default: ({ content }: { content: string }) => <div>{content}</div>,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const asked = (id: number, date: string, rereadOn: string, content: string) => ({
    id, user_id: 1, date, index: 1, title: null, time_of_day: null, mood: null, feelings: [], tags: [], content,
    format: 'plain', visibility: 'private', is_favorite: false, is_archived: false, is_pinned: false,
    created_at: `${date}T12:00:00Z`, sealed_until: null, reread_on: rereadOn,
});

function renderHighlights(onNavigateToEntry = vi.fn()) {
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <ThoughtOfTheDay isOpen onClose={vi.fn()} theme="light" t={t} language="en" onNavigateToEntry={onNavigateToEntry} />
        </QueryClientProvider>,
    );
    return onNavigateToEntry;
}

describe('Highlights reread reminders', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 31, 10));
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                randomEntry: asked(30, '2024-02-02', '2026-10-01', 'A random one'),
                onThisDay: {},
                currentDate: { month: '10', day: '31', year: 2026 },
                openedCapsules: [{
                    entry: asked(31, '2025-10-31', '2026-10-01', 'Dear future me'),
                    sealed_at: '2025-10-31T09:00:00Z',
                    opened_at: '2026-10-31T08:00:00Z',
                    opened_early: false,
                }],
                rereadReminders: [
                    asked(21, '2025-04-01', '2026-10-20', 'The day we moved'),
                    asked(22, '2025-06-12', '2026-10-31', 'First swim of the year'),
                ],
            }),
        });
    });
    afterEach(() => vi.useRealTimers());

    it('asks for the reminders due by the writer’s day and shows them after the opened capsules', async () => {
        renderHighlights();

        const section = (await screen.findByRole('heading', { name: 'You asked to reread this' })).parentElement!;
        expect((globalThis.fetch as Mock).mock.calls[0]![0]).toBe('/api/entries/highlights?today=2026-10-31');
        const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
        expect(headings).toEqual(['Time capsules opened', 'You asked to reread this', 'Random Thought']);
        expect(within(section).getByText('The day we moved')).toBeInTheDocument();
        expect(within(section).getByText('You asked for October 20, 2026')).toBeInTheDocument();
        expect(within(section).getAllByRole('button', { name: /^Done rereading/ })).toHaveLength(2);
    });

    it('takes an entry off the list once done, and says so', async () => {
        const user = userEvent.setup();
        service.clear.mockResolvedValue({ data: { success: true, entry: {} }, error: null });
        renderHighlights();

        await user.click(await screen.findByRole('button', { name: 'Done rereading the entry of April 1, 2025' }));

        expect(service.clear).toHaveBeenCalledWith(21);
        await waitFor(() => expect(screen.queryByText('The day we moved')).not.toBeInTheDocument());
        expect(screen.getByText('First swim of the year')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('The entry of April 1, 2025 is off your reread list.');

        await user.click(screen.getByRole('button', { name: 'Done rereading the entry of June 12, 2025' }));
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'You asked to reread this' })).not.toBeInTheDocument());
    });

    it('keeps the entry and says why when it cannot be marked done, and opens it from its card', async () => {
        const user = userEvent.setup();
        service.clear.mockResolvedValue({ data: null, error: 'rereadRemoveFailed' });
        const onNavigateToEntry = renderHighlights();

        await user.click(await screen.findByRole('button', { name: 'Done rereading the entry of April 1, 2025' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The reminder could not be removed. Try again.');
        expect(screen.getByText('The day we moved')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /The day we moved/ }));
        expect(onNavigateToEntry).toHaveBeenCalledWith('2025-04-01', 1, null);
    });
});
