import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import type { BookOptions, BookVersionData } from './ImportExport.types';

type BookSourceOptions = Pick<BookOptions, 'source' | 'savedSearchId' | 'entryIds'>;

/** Adds where the book's entries come from to a book request: the diary, the saved search or the picked entries. */
export function appendBookSourceParams(params: URLSearchParams, options: BookSourceOptions, diaryId?: number | null): void {
    if (options.source === 'savedSearch') {
        params.append('source', 'savedSearch');
        if (options.savedSearchId !== null) params.append('savedSearchId', options.savedSearchId.toString());
        return;
    }
    if (options.source === 'entries') {
        params.append('source', 'entries');
        params.append('entryIds', options.entryIds.join(','));
        return;
    }
    if (diaryId) params.append('diaryId', diaryId.toString());
}

/**
 * The version history the book belongs to, as `GET /api/books/versions` takes it: the diary's (or all
 * diaries'), the saved search's, or the hand-picked book's. Null while no saved search is chosen.
 */
export function bookVersionsQuery(options: BookSourceOptions, diaryId?: number | null): string | null {
    if (options.source === 'savedSearch' && options.savedSearchId === null) {
        return null;
    }
    const params = new URLSearchParams();
    // Every hand-picked book shares one history, whatever its entries
    appendBookSourceParams(params, { ...options, entryIds: [] }, diaryId);
    params.delete('entryIds');
    return params.toString();
}

/** Whether the source names its entries: always for the journal, once a saved search is chosen or an entry picked. */
export function isBookSourceReady(options: BookSourceOptions): boolean {
    if (options.source === 'savedSearch') return options.savedSearchId !== null;
    if (options.source === 'entries') return options.entryIds.length > 0;
    return true;
}

/** A short line saying where a saved version's entries came from. */
export function describeBookVersionSource(
    source: BookVersionData['source'],
    t: TranslationFunction,
    language: Language,
): string {
    if (source.kind === 'savedSearch') {
        return t('bookVersionSourceSavedSearch', { name: source.savedSearchName ?? '' });
    }
    if (source.kind === 'entries') {
        return pluralPhrase(t, 'bookVersionSourceEntries', source.entryIds?.length ?? 0, language);
    }
    return t('bookVersionSourceJournal');
}
