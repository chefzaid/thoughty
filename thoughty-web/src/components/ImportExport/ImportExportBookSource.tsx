import type { TranslationFunction } from '../../types';
import type { SavedSearch } from '../../services/api/savedSearchesService';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { BOOK_SOURCE_OPTIONS, type BookOptions, type BookPickedEntries, type BookSource } from './ImportExport.types';
import type { BookSourceLoad } from './useBookSourceData';
import './ImportExportBookSource.css';

type OptionChange = <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;

/** A saved search a book cannot be built from: one that matches by meaning. */
const isMeaningSearch = (saved: SavedSearch) => saved.filters.searchMode === 'semantic' && saved.filters.search.trim() !== '';

export function BookSourceControls({
    options,
    diaryName,
    savedSearches,
    pickedEntries,
    onOptionChange,
    language,
    t,
}: Readonly<{
    options: BookOptions;
    diaryName?: string;
    savedSearches: BookSourceLoad<SavedSearch[]>;
    pickedEntries: BookSourceLoad<BookPickedEntries>;
    onOptionChange: OptionChange;
    language: Language;
    t: TranslationFunction;
}>) {
    return (
        <div className="book-source">
            <div className="book-options-grid book-options-grid--title">
                <div className="export-option-group book-field">
                    <label htmlFor="book-source">{t('bookSourceLabel')}</label>
                    <select
                        id="book-source"
                        className="format-select"
                        value={options.source}
                        onChange={(event) => onOptionChange('source', event.target.value as BookSource)}
                    >
                        {BOOK_SOURCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{t(option.labelKey, { diaryName: diaryName || '' })}</option>
                        ))}
                    </select>
                </div>
                {options.source === 'savedSearch' && (
                    <SavedSearchPicker options={options} savedSearches={savedSearches} onOptionChange={onOptionChange} t={t} />
                )}
            </div>
            {options.source === 'savedSearch' && <SavedSearchStatus savedSearches={savedSearches} t={t} />}
            {options.source === 'entries' && (
                <PickedEntriesList
                    entryIds={options.entryIds}
                    pickedEntries={pickedEntries}
                    onChange={(entryIds) => onOptionChange('entryIds', entryIds)}
                    language={language}
                    t={t}
                />
            )}
        </div>
    );
}

function SavedSearchPicker({
    options,
    savedSearches,
    onOptionChange,
    t,
}: Readonly<{
    options: BookOptions;
    savedSearches: BookSourceLoad<SavedSearch[]>;
    onOptionChange: OptionChange;
    t: TranslationFunction;
}>) {
    const searches = savedSearches.status === 'ready' ? savedSearches.data : [];
    return (
        <div className="export-option-group book-field">
            <label htmlFor="book-saved-search">{t('bookSavedSearchLabel')}</label>
            <select
                id="book-saved-search"
                className="format-select"
                value={options.savedSearchId ?? ''}
                disabled={searches.length === 0}
                onChange={(event) => onOptionChange('savedSearchId', event.target.value ? Number(event.target.value) : null)}
            >
                <option value="">{t('bookSavedSearchPlaceholder')}</option>
                {searches.map((saved) => (
                    <option key={saved.id} value={saved.id} disabled={isMeaningSearch(saved)}>
                        {isMeaningSearch(saved) ? t('bookSavedSearchSemantic', { name: saved.name }) : saved.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

function SavedSearchStatus({ savedSearches, t }: Readonly<{ savedSearches: BookSourceLoad<SavedSearch[]>; t: TranslationFunction }>) {
    if (savedSearches.status === 'error') {
        return <p className="book-source__note book-source__note--error" role="alert">{t(savedSearches.error)}</p>;
    }
    if (savedSearches.status !== 'ready') {
        return null;
    }
    return (
        <p className="book-source__note">
            {t(savedSearches.data.length === 0 ? 'bookSavedSearchEmpty' : 'bookSavedSearchHint')}
        </p>
    );
}

function PickedEntriesList({
    entryIds,
    pickedEntries,
    onChange,
    language,
    t,
}: Readonly<{
    entryIds: number[];
    pickedEntries: BookSourceLoad<BookPickedEntries>;
    onChange: (entryIds: number[]) => void;
    language: Language;
    t: TranslationFunction;
}>) {
    if (entryIds.length === 0) {
        return <p className="book-source__note">{t('bookPickedEmpty')}</p>;
    }

    const remove = (id: number) => onChange(entryIds.filter((entryId) => entryId !== id));
    return (
        <div className="book-picked">
            <div className="book-picked__header">
                <strong>{pluralPhrase(t, 'bookPickedCount', entryIds.length, language)}</strong>
                <button type="button" className="io-btn secondary book-picked__clear" onClick={() => onChange([])}>
                    {t('bookPickedClear')}
                </button>
            </div>
            {pickedEntries.status === 'loading' && <p className="book-source__note">{t('bookPickedLoading')}</p>}
            {pickedEntries.status === 'error' && (
                <p className="book-source__note book-source__note--error" role="alert">{t(pickedEntries.error)}</p>
            )}
            {pickedEntries.status === 'ready' && (
                <ul className="book-picked__list">
                    {pickedEntries.data.missingIds.map((id) => {
                        const label = t('bookPickedMissingEntry', { id });
                        return (
                            <li key={`missing-${id}`} className="book-picked__item book-picked__item--missing">
                                <div className="book-picked__main">
                                    <span className="book-picked__title">{label}</span>
                                    <span className="book-picked__meta">{t('bookPickedMissing')}</span>
                                </div>
                                <RemoveButton label={t('bookPickedRemove', { entry: label })} onClick={() => remove(id)} />
                            </li>
                        );
                    })}
                    {pickedEntries.data.entries.map((entry) => {
                        const heading = entry.title || entry.excerpt || entry.date;
                        return (
                            <li key={entry.id} className="book-picked__item">
                                <div className="book-picked__main">
                                    <span className="book-picked__title">{heading}</span>
                                    <span className="book-picked__meta">
                                        {[entry.date, entry.diaryName, entry.isArchived ? t('archived') : null].filter(Boolean).join(' · ')}
                                    </span>
                                    {entry.title && entry.excerpt && <span className="book-picked__excerpt">{entry.excerpt}</span>}
                                </div>
                                <RemoveButton label={t('bookPickedRemove', { entry: `${entry.date} ${heading}` })} onClick={() => remove(entry.id)} />
                            </li>
                        );
                    })}
                </ul>
            )}
            <p className="book-source__note">{t('bookPickedHint')}</p>
        </div>
    );
}

function RemoveButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
    return (
        <button type="button" className="io-icon-btn" aria-label={label} title={label} onClick={onClick}>
            <span className="codicon codicon-close" aria-hidden="true" />
        </button>
    );
}
