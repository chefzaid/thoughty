import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import RereadReminderBadge from './RereadReminderBadge';
import RereadReminderDialog from './RereadReminderDialog';

const service = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }));

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const tFr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const entry = { id: 4, date: '2025-04-01', title: 'Moving day', reread_on: null };
const saved = { data: { success: true, entry: { id: 4 } }, error: null };

function renderWithClient(ui: ReactElement) {
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
    return { invalidate };
}

describe('RereadReminderDialog', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 31, 10));
        service.set.mockReset().mockResolvedValue(saved);
    });
    afterEach(() => vi.useRealTimers());

    it('offers a week, a month or a year, starting on a week, and saves the day with the writer’s day', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const { invalidate } = renderWithClient(<RereadReminderDialog entry={entry} isDark={false} language="en" onClose={onClose} t={t} />);

        const dialog = screen.getByRole('dialog', { name: 'Remind me to reread' });
        expect(dialog).toHaveTextContent('April 1, 2025 · Moving day');
        const day = screen.getByLabelText('Day to reread it');
        expect(day).toHaveFocus();
        expect(day).toHaveValue('2026-11-07');
        expect(day).toHaveAttribute('min', '2026-11-01');
        expect(day).toHaveAttribute('max', '2076-10-31');
        expect(screen.getByRole('button', { name: 'In a week' })).toHaveAttribute('aria-pressed', 'true');

        await user.click(screen.getByRole('button', { name: 'In a year' }));
        expect(day).toHaveValue('2027-10-31');
        expect(screen.getByRole('button', { name: 'In a week' })).toHaveAttribute('aria-pressed', 'false');
        await user.click(screen.getByRole('button', { name: 'Remind me' }));

        expect(service.set).toHaveBeenCalledWith(4, '2027-10-31', '2026-10-31');
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(invalidate).toHaveBeenCalled();
    });

    it('starts on the day already asked for, and refuses a day outside tomorrow to fifty years', async () => {
        const user = userEvent.setup();
        renderWithClient(
            <RereadReminderDialog entry={{ ...entry, reread_on: '2027-03-15' }} isDark language="en" onClose={vi.fn()} t={t} />,
        );

        const day = screen.getByLabelText('Day to reread it');
        expect(day).toHaveValue('2027-03-15');
        await user.clear(day);
        await user.type(day, '2026-10-31');
        await user.click(screen.getByRole('button', { name: 'Remind me' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Choose a day from tomorrow up to 50 years ahead.');
        expect(day).toHaveAttribute('aria-invalid', 'true');
        expect(service.set).not.toHaveBeenCalled();
    });

    it('says why the API refused, and closes on Cancel', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        service.set.mockResolvedValue({ data: null, error: 'apiError_ENTRY_SEALED' });
        renderWithClient(<RereadReminderDialog entry={entry} isDark={false} language="en" onClose={onClose} t={t} />);

        await user.click(screen.getByRole('button', { name: 'Remind me' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('sealed');
        expect(onClose).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
    });
});

describe('RereadReminderBadge', () => {
    beforeEach(() => service.clear.mockReset());

    it('says when the writer asked to reread the entry, and removes the reminder', async () => {
        const user = userEvent.setup();
        service.clear.mockResolvedValue(saved);
        const { invalidate } = renderWithClient(<RereadReminderBadge entryId={4} rereadOn="2026-11-07" isDark={false} language="en" t={t} />);

        expect(screen.getByText('Reread on November 7, 2026')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Remove the reminder to reread on November 7, 2026' }));

        expect(service.clear).toHaveBeenCalledWith(4);
        await waitFor(() => expect(invalidate).toHaveBeenCalled());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so in French when the reminder cannot be removed', async () => {
        const user = userEvent.setup();
        service.clear.mockResolvedValue({ data: null, error: 'rereadRemoveFailed' });
        renderWithClient(<RereadReminderBadge entryId={4} rereadOn="2026-11-07" isDark language="fr" t={tFr} />);

        expect(screen.getByText('À relire le 7 novembre 2026')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Retirer le rappel de relecture du 7 novembre 2026' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Le rappel n’a pas pu être retiré. Réessayez.');
    });
});
