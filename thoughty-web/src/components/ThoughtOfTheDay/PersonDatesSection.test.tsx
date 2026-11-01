import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PersonDatesSection from './PersonDatesSection';
import type { components } from '../../generated/openapi';
import { QuietModeOn } from '../../test/quietMode';
import { getTranslation, type Language } from '../../utils/translations';

vi.mock('../EntryContentRenderer/EntryContentRenderer', () => ({
    default: ({ content }: { content: string }) => <div>{content}</div>,
}));

type PersonOfTheDay = components['schemas']['PersonDateHighlightDto'];
type Entry = components['schemas']['EntryResponseDto'];

const latest = { id: 21, date: '2026-03-01', index: 1, content: 'Tea with @Marie', tags: [] } as unknown as Entry;
const marie: PersonOfTheDay = { id: 12, name: 'Marie', date: { kind: 'birthday', month: 3, day: 14, year: 1992 }, years: 34, entryCount: 2, latestEntry: latest };
const paul: PersonOfTheDay = { id: 13, name: 'Paul', date: { kind: 'anniversary', month: 3, day: 14, year: 2025 }, years: 1, entryCount: 1, latestEntry: latest };
const zoe: PersonOfTheDay = { id: 14, name: 'Zoé', date: { kind: 'birthday', month: 3, day: 14, year: null }, years: null, entryCount: 0, latestEntry: null };

function renderSection(language: Language = 'en', quiet = false) {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    const onSelectEntry = vi.fn();
    const onOpenPerson = vi.fn();
    const section = (
        <PersonDatesSection people={[marie, paul, zoe]} language={language} formatDate={(date) => date} onSelectEntry={onSelectEntry} onOpenPerson={onOpenPerson} t={t} />
    );
    render(<MemoryRouter>{quiet ? <QuietModeOn>{section}</QuietModeOn> : section}</MemoryRouter>);
    return { onSelectEntry, onOpenPerson, items: screen.getAllByRole('listitem') };
}

describe('PersonDatesSection', () => {
    it('shows each person with what the day marks, their age or years, their entries and the newest one', () => {
        const { items, onSelectEntry, onOpenPerson } = renderSection();

        expect(screen.getByRole('heading', { name: 'Birthdays and anniversaries' })).toBeInTheDocument();
        expect(items[0]).toHaveTextContent('Marie · Birthday · Turns 34 today');
        expect(items[0]).toHaveTextContent('2 entries mention Marie');
        expect(items[1]).toHaveTextContent('Paul · Anniversary · 1 year today');
        expect(items[1]).toHaveTextContent('1 entry mentions Paul');
        expect(items[2]).toHaveTextContent('Zoé · Birthday');
        expect(items[2]).toHaveTextContent('No entry mentions Zoé for now.');
        expect(items[2]).not.toHaveTextContent('Most recent entry');

        const link = within(items[0]!).getByRole('link', { name: 'Entries that mention Marie' });
        expect(link).toHaveAttribute('href', '/journal?diary=all&person=12');
        fireEvent.click(link);
        expect(onOpenPerson).toHaveBeenCalled();

        expect(items[0]).toHaveTextContent('Most recent entry');
        fireEvent.click(within(items[0]!).getByRole('button', { name: /Tea with @Marie/ }));
        expect(onSelectEntry).toHaveBeenCalledWith(latest);
    });

    it('leaves out the age and the years in quiet mode, and keeps the rest', () => {
        const { items } = renderSection('en', true);

        expect(items[0]).toHaveTextContent('Marie · Birthday2 entries mention Marie');
        expect(items[0]).not.toHaveTextContent('Turns');
        expect(items[1]).not.toHaveTextContent('year today');
    });

    it('speaks French', () => {
        const { items } = renderSection('fr');

        expect(screen.getByRole('heading', { name: 'Anniversaires du jour' })).toBeInTheDocument();
        expect(items[0]).toHaveTextContent('Marie · Anniversaire · A 34 ans aujourd’hui');
        expect(items[0]).toHaveTextContent('2 entrées mentionnent Marie');
        expect(items[1]).toHaveTextContent('Paul · Date anniversaire · 1 an aujourd’hui');
        expect(items[2]).toHaveTextContent('Aucune entrée ne mentionne Zoé pour l’instant.');
        expect(items[0]).toHaveTextContent('Entrée la plus récente');
    });
});
