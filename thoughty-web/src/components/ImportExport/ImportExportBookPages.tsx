import type { TranslationFunction } from '../../types';
import { BOOK_DEDICATION_MAX_LENGTH, BOOK_EPIGRAPH_MAX_LENGTH, type BookOptions } from './ImportExport.types';

const PAGE_FIELDS = [
    { key: 'dedication', labelKey: 'bookDedicationLabel', placeholderKey: 'bookDedicationPlaceholder', maxLength: BOOK_DEDICATION_MAX_LENGTH, rows: 2 },
    { key: 'epigraph', labelKey: 'bookEpigraphLabel', placeholderKey: 'bookEpigraphPlaceholder', maxLength: BOOK_EPIGRAPH_MAX_LENGTH, rows: 3 },
] as const;

/** The book's own pages: an optional dedication and epigraph after the title page, and a closing page. */
export function BookPagesControls({
    options,
    onOptionChange,
    t,
}: Readonly<{
    options: BookOptions;
    onOptionChange: <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;
    t: TranslationFunction;
}>) {
    return (
        <fieldset className="book-pages-controls" aria-describedby="book-pages-hint">
            <legend>{t('bookPages')}</legend>
            <p id="book-pages-hint" className="book-field-hint">
                {t('bookPagesHint', { dedicationMax: BOOK_DEDICATION_MAX_LENGTH, epigraphMax: BOOK_EPIGRAPH_MAX_LENGTH })}
            </p>
            <div className="book-options-grid book-options-grid--title">
                {PAGE_FIELDS.map((field) => (
                    <div key={field.key} className="export-option-group book-field">
                        <label htmlFor={`book-${field.key}`}>{t(field.labelKey)}</label>
                        <textarea
                            id={`book-${field.key}`}
                            value={options[field.key]}
                            placeholder={t(field.placeholderKey)}
                            maxLength={field.maxLength}
                            rows={field.rows}
                            onChange={(event) => onOptionChange(field.key, event.target.value)}
                        />
                    </div>
                ))}
            </div>
            <label className="checkbox-label book-pages-controls__closing">
                <input
                    type="checkbox"
                    checked={options.closingPage}
                    onChange={(event) => onOptionChange('closingPage', event.target.checked)}
                />
                {t('bookClosingPage')}
            </label>
        </fieldset>
    );
}
