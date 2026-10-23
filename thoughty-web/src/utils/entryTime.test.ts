import { describe, expect, it } from 'vitest';
import {
    cleanEntryTitle,
    compareSameDayEntries,
    currentTimeOfDay,
    formatTimeOfDay,
    isManuallyOrdered,
    MAX_ENTRY_TITLE_LENGTH,
    reassignSameDayIndexes,
} from './entryTime';

describe('compareSameDayEntries', () => {
    it('lists untimed entries first in index order, then timed entries by time, ties by index', () => {
        const day = [
            { id: 1, index: 1, time_of_day: '21:00' },
            { id: 2, index: 2, time_of_day: null },
            { id: 3, index: 3, time_of_day: '07:30' },
            { id: 4, index: 4 },
            { id: 5, index: 5, time_of_day: '07:30' },
        ];

        expect([...day].sort(compareSameDayEntries).map((entry) => entry.id)).toEqual([2, 4, 3, 5, 1]);
    });

    it('treats an empty time as no time', () => {
        expect(compareSameDayEntries({ index: 2, time_of_day: '' }, { index: 1, time_of_day: '06:00' })).toBeLessThan(0);
    });
});

describe('isManuallyOrdered', () => {
    it('lets only entries without a time be dragged', () => {
        expect(isManuallyOrdered({ time_of_day: null })).toBe(true);
        expect(isManuallyOrdered({})).toBe(true);
        expect(isManuallyOrdered({ time_of_day: '08:00' })).toBe(false);
    });
});

describe('reassignSameDayIndexes', () => {
    it('trades the indexes the listed entries hold and leaves the others alone', () => {
        const day = [
            { id: 10, index: 1 },
            { id: 11, index: 2, time_of_day: '09:00' },
            { id: 12, index: 3 },
            { id: 13, index: 4 },
        ];

        expect([...reassignSameDayIndexes(day, [13, 10, 12])]).toEqual([[13, 1], [10, 3], [12, 4]]);
    });

    it('ignores unknown and repeated ids', () => {
        const day = [{ id: 1, index: 1 }, { id: 2, index: 2 }];

        expect([...reassignSameDayIndexes(day, [2, 99, 2, 1])]).toEqual([[2, 1], [1, 2]]);
    });
});

describe('currentTimeOfDay', () => {
    it('gives the local time as HH:MM', () => {
        expect(currentTimeOfDay(new Date(2024, 0, 15, 7, 5, 59))).toBe('07:05');
        expect(currentTimeOfDay(new Date(2024, 0, 15, 23, 40))).toBe('23:40');
    });
});

describe('formatTimeOfDay', () => {
    it('shows the time as the language writes it', () => {
        expect(formatTimeOfDay('18:45', 'en')).toMatch(/^6:45\sPM$/);
        expect(formatTimeOfDay('20:05', 'fr')).toBe('20:05');
    });

    it('returns text that is not a time unchanged', () => {
        expect(formatTimeOfDay('soon', 'en')).toBe('soon');
    });
});

describe('cleanEntryTitle', () => {
    it('trims the title onto one line and caps its length', () => {
        expect(cleanEntryTitle('  A walk\n by the   sea ')).toBe('A walk by the sea');
        expect(cleanEntryTitle('x'.repeat(MAX_ENTRY_TITLE_LENGTH + 20))).toHaveLength(MAX_ENTRY_TITLE_LENGTH);
    });

    it('gives null for an empty title', () => {
        expect(cleanEntryTitle('   ')).toBeNull();
    });
});
