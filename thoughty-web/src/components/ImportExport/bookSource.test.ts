import { describe, expect, it } from 'vitest';
import { getTranslation } from '../../utils/translations';
import { appendBookSourceParams, bookVersionsQuery, describeBookVersionSource, isBookSourceReady } from './bookSource';

const journal = { source: 'journal' as const, savedSearchId: null, entryIds: [] };

describe('book source', () => {
    it('sends the diary, the saved search or the picked entries with a book request', () => {
        const params = (options: Parameters<typeof appendBookSourceParams>[1], diaryId?: number | null) => {
            const search = new URLSearchParams();
            appendBookSourceParams(search, options, diaryId);
            return search.toString();
        };

        expect(params(journal, 2)).toBe('diaryId=2');
        expect(params(journal, null)).toBe('');
        expect(params({ ...journal, source: 'savedSearch', savedSearchId: 4 }, 2)).toBe('source=savedSearch&savedSearchId=4');
        expect(params({ ...journal, source: 'savedSearch' }, 2)).toBe('source=savedSearch');
        expect(params({ ...journal, source: 'entries', entryIds: [5, 3] }, 2)).toBe('source=entries&entryIds=5%2C3');
    });

    it('lists the history of the diary, of the saved search, or of hand-picked books', () => {
        expect(bookVersionsQuery(journal, 2)).toBe('diaryId=2');
        expect(bookVersionsQuery(journal)).toBe('');
        expect(bookVersionsQuery({ ...journal, source: 'savedSearch', savedSearchId: 4 }, 2)).toBe('source=savedSearch&savedSearchId=4');
        expect(bookVersionsQuery({ ...journal, source: 'savedSearch' }, 2)).toBeNull();
        expect(bookVersionsQuery({ ...journal, source: 'entries', entryIds: [5] }, 2)).toBe('source=entries');
    });

    it('is ready once the source names its entries', () => {
        expect(isBookSourceReady(journal)).toBe(true);
        expect(isBookSourceReady({ ...journal, source: 'savedSearch' })).toBe(false);
        expect(isBookSourceReady({ ...journal, source: 'savedSearch', savedSearchId: 1 })).toBe(true);
        expect(isBookSourceReady({ ...journal, source: 'entries' })).toBe(false);
        expect(isBookSourceReady({ ...journal, source: 'entries', entryIds: [1] })).toBe(true);
    });

    it('describes a version’s source in both languages', () => {
        const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
        const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

        expect(describeBookVersionSource({ kind: 'journal' }, en, 'en')).toBe('From the journal');
        expect(describeBookVersionSource({ kind: 'savedSearch' }, en, 'en')).toBe('From the saved search ');
        expect(describeBookVersionSource({ kind: 'entries' }, fr, 'fr')).toBe('0 entrée choisie');
        expect(describeBookVersionSource({ kind: 'entries', entryIds: [1, 2, 3] }, en, 'en')).toBe('3 hand-picked entries');
    });
});
