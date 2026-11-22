import type { TranslationFunction } from '../../types';
import type { BookInteriorTheme, BookOptions } from './ImportExport.types';
import './ImportExportBookInterior.css';

const INTERIOR_THEMES: ReadonlyArray<{ value: BookInteriorTheme; labelKey: string; descriptionKey: string }> = [
    { value: 'standard', labelKey: 'bookInteriorStandard', descriptionKey: 'bookInteriorStandardDescription' },
    { value: 'elegant', labelKey: 'bookInteriorElegant', descriptionKey: 'bookInteriorElegantDescription' },
    { value: 'large-print', labelKey: 'bookInteriorLargePrint', descriptionKey: 'bookInteriorLargePrintDescription' },
];

/** The interior theme of the book's pages: its type, margins, chapter openings and photos. */
export function BookInteriorControls({
    options,
    onOptionChange,
    t,
}: Readonly<{
    options: BookOptions;
    onOptionChange: <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;
    t: TranslationFunction;
}>) {
    return (
        <fieldset className="book-interior-controls" aria-describedby="book-interior-hint">
            <legend>{t('bookInterior')}</legend>
            <p id="book-interior-hint" className="book-field-hint">{t('bookInteriorHint')}</p>
            <div className="book-interior-themes" role="radiogroup" aria-label={t('bookInteriorTheme')}>
                {INTERIOR_THEMES.map((theme) => {
                    const selected = options.interiorTheme === theme.value;
                    const nameId = `book-interior-${theme.value}-name`;
                    const descriptionId = `book-interior-${theme.value}-description`;
                    return (
                        <label
                            key={theme.value}
                            className={`book-interior-option book-interior-option--${theme.value} ${selected ? 'is-selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="book-interior-theme"
                                value={theme.value}
                                checked={selected}
                                aria-labelledby={nameId}
                                aria-describedby={descriptionId}
                                onChange={() => onOptionChange('interiorTheme', theme.value)}
                            />
                            <span className="book-interior-option__sample" aria-hidden="true">Aa</span>
                            <span className="book-interior-option__text">
                                <span id={nameId} className="book-interior-option__name">{t(theme.labelKey)}</span>
                                <span id={descriptionId} className="book-interior-option__description">{t(theme.descriptionKey)}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
