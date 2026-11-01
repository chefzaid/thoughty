import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import StatsWritingTimes from './StatsWritingTimes';
import { getTranslation, type Language } from '../../utils/translations';
import { QuietModeOn } from '../../test/quietMode';

const hoursWith = (counts: Record<number, number>) => Array.from({ length: 24 }, (_, hour) => counts[hour] ?? 0);

// Nine entries: six at 9 PM, two at 7 AM, one at noon; five on Tuesdays, three on Saturdays, one on Sunday
const writingTimes = { hours: hoursWith({ 7: 2, 12: 1, 21: 6 }), weekdays: [0, 5, 0, 0, 0, 3, 1] };

const renderTimes = (options: { language?: Language; quiet?: boolean; times?: typeof writingTimes } = {}) => {
    const language = options.language ?? 'en';
    return render(
        <StatsWritingTimes
            writingTimes={options.times ?? writingTimes}
            timeZone="Pacific/Kiritimati"
            themeClass="dark"
            language={language}
            t={(key, params) => getTranslation(language, key, params)}
        />,
        options.quiet ? { wrapper: QuietModeOn } : undefined,
    );
};

describe('StatsWritingTimes', () => {
    it('shows the hours and weekdays written most, in the writer’s time zone', () => {
        const { container } = renderTimes();

        const card = screen.getByRole('region', { name: 'When you write' });
        expect(within(card).getByText(/in your time zone \(Pacific\/Kiritimati\)/)).toBeInTheDocument();
        expect(within(card).getByText('You write most often around 9 PM, and on Tuesday.')).toBeInTheDocument();
        expect(within(card).getByRole('img', { name: 'Entries by hour of the day: 7 AM: 2 entries; 12 PM: 1 entry; 9 PM: 6 entries' })).toBeInTheDocument();
        expect(within(card).getByText('Saturday: 3 entries')).toBeInTheDocument();
        expect(within(card).getByText('Monday: 0 entries')).toBeInTheDocument();

        // Bars are drawn against the busiest hour and day
        const fills = container.querySelectorAll<HTMLElement>('.writing-times-hour-fill');
        expect(fills).toHaveLength(24);
        expect(fills[21]?.style.height).toBe('100%');
        expect(fills[7]?.style.height).toBe(`${(2 / 6) * 100}%`);
        expect(fills[0]?.style.height).toBe('0%');
        expect(container.querySelector<HTMLElement>('.writing-times-weekday-fill')?.style.width).toBe('0%');
        expect(within(card).getByText('12 AM')).toBeInTheDocument();
        expect(within(card).getByText('6 PM')).toBeInTheDocument();
    });

    it('shows the same counts as two tables', () => {
        renderTimes();

        const toggle = screen.getByRole('button', { name: 'Show as table' });
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true');

        const byHour = screen.getByRole('table', { name: 'By hour of the day' });
        expect(within(byHour).getAllByRole('row')).toHaveLength(25);
        expect(within(byHour).getByRole('columnheader', { name: 'Entries' })).toBeInTheDocument();
        expect(within(within(byHour).getByRole('rowheader', { name: '9 PM' }).closest('tr')!).getByText('6')).toBeInTheDocument();
        const byWeekday = screen.getByRole('table', { name: 'By day of the week' });
        expect(within(within(byWeekday).getByRole('rowheader', { name: 'Tuesday' }).closest('tr')!).getByText('5')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('keeps the shape in quiet mode and says how often in words instead of counts', () => {
        const { container } = renderTimes({ quiet: true });

        const card = screen.getByRole('region', { name: 'When you write' });
        expect(within(card).getByText('You write most often around 9 PM, and on Tuesday.')).toBeInTheDocument();
        expect(within(card).getByRole('img', { name: 'Entries by hour of the day: 7 AM: now and then; 12 PM: now and then; 9 PM: most often' })).toBeInTheDocument();
        expect(within(card).getByText('Saturday: often')).toBeInTheDocument();
        expect(within(card).getByText('Sunday: now and then')).toBeInTheDocument();
        expect(within(card).getByText('Monday: not yet')).toBeInTheDocument();
        expect(container.querySelectorAll('.writing-times-hour-fill')).toHaveLength(24);
        expect(container.querySelector('.writing-times-hour[title="9 PM: most often"]')).toBeInTheDocument();
        expect(card.textContent).not.toMatch(/\d+ entr/);

        fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
        const byHour = screen.getByRole('table', { name: 'By hour of the day' });
        expect(within(byHour).getByRole('columnheader', { name: 'How often' })).toBeInTheDocument();
        expect(within(within(byHour).getByRole('rowheader', { name: '9 PM' }).closest('tr')!).getByText('most often')).toBeInTheDocument();
        // No cell holds a count: only the hour names carry digits
        for (const cell of screen.getAllByRole('cell')) {
            expect(cell.textContent).not.toMatch(/\d/);
        }
    });

    it('speaks French, with the hours and weekdays as French names them', () => {
        renderTimes({ language: 'fr' });

        const card = screen.getByRole('region', { name: 'Quand vous écrivez' });
        expect(within(card).getByText('Vous écrivez le plus souvent vers 21 h, et le mardi.')).toBeInTheDocument();
        expect(within(card).getByRole('img', { name: 'Entrées par heure de la journée : 07 h : 2 entrées; 12 h : 1 entrée; 21 h : 6 entrées' })).toBeInTheDocument();
        expect(within(card).getByText('lundi : 0 entrée')).toBeInTheDocument();
        fireEvent.click(within(card).getByRole('button', { name: 'Afficher en tableau' }));
        expect(screen.getByRole('table', { name: 'Par jour de la semaine' })).toBeInTheDocument();
    });

    it('invites a writer without entries to write a few first', () => {
        renderTimes({ times: { hours: hoursWith({}), weekdays: [0, 0, 0, 0, 0, 0, 0] } });

        const card = screen.getByRole('region', { name: 'When you write' });
        expect(within(card).getByText('Once you have written a few entries, this shows the hours and days you write most.')).toBeInTheDocument();
        expect(within(card).queryByRole('button')).not.toBeInTheDocument();
        expect(within(card).queryByRole('img')).not.toBeInTheDocument();
    });
});
