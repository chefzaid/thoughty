import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import ReachOutSection from './ReachOutSection';
import type { components } from '../../generated/openapi';
import { createTestQueryClient } from '../../test/queryClient';
import { PEOPLE_QUERY_KEY } from '../../utils/mentions';
import { getTranslation, type Language } from '../../utils/translations';

const service = vi.hoisted(() => ({ markContacted: vi.fn() }));

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

type ReachOut = components['schemas']['PersonReachOutHighlightDto'];

const leo: ReachOut = { id: 13, name: 'Léo', reachOutDays: 14, lastContactOn: null, lastMentionedOn: null, daysSince: null };
const marie: ReachOut = { id: 12, name: 'Marie', reachOutDays: 30, lastContactOn: '2026-09-01', lastMentionedOn: '2026-10-01', daysSince: 52 };
const paul: ReachOut = { id: 14, name: 'Paul', reachOutDays: 365, lastContactOn: null, lastMentionedOn: '2025-11-21', daysSince: 1 };

function renderSection(language: Language = 'en') {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    const onOpenPerson = vi.fn();
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ReachOutSection people={[leo, marie, paul]} language={language} onOpenPerson={onOpenPerson} t={t} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
    return { onOpenPerson, invalidate };
}

describe('ReachOutSection', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 10, 22, 10));
        service.markContacted.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('shows each person with the reminder, how long since they were last in touch and the dates on record', () => {
        const { onOpenPerson } = renderSection();

        expect(screen.getByRole('heading', { name: 'Time to reach out' })).toBeInTheDocument();
        const items = screen.getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('Léo · reminder after 2 weeks');
        expect(items[0]).toHaveTextContent('No contact with Léo and no entry about them on record yet.');
        expect(items[1]).toHaveTextContent('Marie · reminder after 1 month');
        expect(items[1]).toHaveTextContent('Last in touch 52 days ago');
        expect(items[1]).toHaveTextContent('Last contact: Sep 1, 2026 · Last mentioned: Oct 1, 2026');
        expect(items[2]).toHaveTextContent('Last in touch 1 day ago');

        const link = within(items[1]!).getByRole('link', { name: 'Entries that mention Marie' });
        expect(link).toHaveAttribute('href', '/journal?diary=all&person=12');
        fireEvent.click(link);
        expect(onOpenPerson).toHaveBeenCalled();
    });

    it('records today as the last contact, takes the person off the list and reloads the people', async () => {
        service.markContacted.mockResolvedValue({ data: { id: 12 }, error: null });
        const { invalidate } = renderSection();

        fireEvent.click(screen.getByRole('button', { name: 'Contacted Marie today' }));

        await waitFor(() => expect(screen.queryByText('Marie')).not.toBeInTheDocument());
        expect(service.markContacted).toHaveBeenCalledWith(12, '2026-11-22');
        expect(screen.getByRole('status')).toHaveTextContent('Last contact with Marie set to today.');
        expect(invalidate).toHaveBeenCalledWith({ queryKey: PEOPLE_QUERY_KEY });
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('says why a contact was not saved and keeps the person, ignoring a second click meanwhile', async () => {
        let finish: (value: unknown) => void = () => undefined;
        service.markContacted.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
        renderSection();

        const button = screen.getByRole('button', { name: 'Contacted Léo today' });
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Contacted Paul today' }));
        expect(service.markContacted).toHaveBeenCalledTimes(1);
        finish({ data: null, error: null });

        expect(await screen.findByRole('alert')).toHaveTextContent('The contact could not be saved. Try again.');
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('hides the heading once everyone is done, and speaks French', async () => {
        service.markContacted.mockResolvedValue({ data: { id: 13 }, error: null });
        const t = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <MemoryRouter>
                    <ReachOutSection people={[leo]} language="fr" onOpenPerson={vi.fn()} t={t} />
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(screen.getByRole('heading', { name: 'Prendre des nouvelles' })).toBeInTheDocument();
        expect(screen.getByRole('listitem')).toHaveTextContent('Léo · rappel après 2 semaines');
        fireEvent.click(screen.getByRole('button', { name: 'J’ai pris contact avec Léo aujourd’hui' }));

        await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
        expect(screen.getByRole('status')).toHaveTextContent('Dernier contact avec Léo : aujourd’hui.');
    });
});
