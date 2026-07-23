import { useEffect, useState } from 'react';
import type { TranslationFunction } from '../../types';
import type { BookCoverTheme, BookOptions } from './ImportExport.types';

const MAX_COVER_IMAGE_SIZE = 2 * 1024 * 1024;
const COVER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

const COVER_THEMES: ReadonlyArray<{
    value: BookCoverTheme;
    labelKey: string;
    colors: readonly [string, string, string];
}> = [
    { value: 'classic', labelKey: 'bookCoverThemeClassic', colors: ['#fffaf0', '#292524', '#b45309'] },
    { value: 'ocean', labelKey: 'bookCoverThemeOcean', colors: ['#e0f2fe', '#0c4a6e', '#0284c7'] },
    { value: 'forest', labelKey: 'bookCoverThemeForest', colors: ['#ecfdf5', '#14532d', '#16a34a'] },
    { value: 'rose', labelKey: 'bookCoverThemeRose', colors: ['#fdf2f8', '#831843', '#db2777'] },
];

export function BookCoverControls({
    options,
    onOptionChange,
    t,
}: Readonly<{
    options: BookOptions;
    onOptionChange: <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;
    t: TranslationFunction;
}>) {
    const [previewUrl, setPreviewUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!options.coverImage || typeof URL.createObjectURL !== 'function') {
            setPreviewUrl('');
            return undefined;
        }

        const nextUrl = URL.createObjectURL(options.coverImage);
        setPreviewUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [options.coverImage]);

    function selectImage(file?: File): void {
        setError('');
        if (!file) {
            return;
        }
        if (!COVER_IMAGE_TYPES.has(file.type) || file.size > MAX_COVER_IMAGE_SIZE) {
            setError(t('bookCoverImageInvalid'));
            return;
        }
        onOptionChange('coverImage', file);
    }

    return (
        <fieldset className="book-cover-controls">
            <legend>{t('bookCover')}</legend>
            <div className="book-cover-controls__content">
                <div className="book-cover-themes" role="radiogroup" aria-label={t('bookCoverTheme')}>
                    {COVER_THEMES.map((theme) => (
                        <label
                            key={theme.value}
                            className={`book-cover-swatch ${options.coverTheme === theme.value ? 'is-selected' : ''}`}
                            title={t(theme.labelKey)}
                        >
                            <input
                                type="radio"
                                name="book-cover-theme"
                                value={theme.value}
                                checked={options.coverTheme === theme.value}
                                onChange={() => onOptionChange('coverTheme', theme.value)}
                            />
                            <span className="book-cover-swatch__colors" aria-hidden="true">
                                {theme.colors.map((color) => (
                                    <span key={color} style={{ backgroundColor: color }} />
                                ))}
                            </span>
                            <span>{t(theme.labelKey)}</span>
                        </label>
                    ))}
                </div>

                <div className="book-cover-image">
                    {previewUrl && (
                        <img src={previewUrl} alt={t('bookCoverPreview')} className="book-cover-image__preview" />
                    )}
                    <div className="book-cover-image__actions">
                        <label className="io-btn secondary book-cover-image__picker">
                            <span className="codicon codicon-file-media" aria-hidden="true" />
                            {options.coverImage ? t('bookCoverReplaceImage') : t('bookCoverChooseImage')}
                            <input
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={(event) => {
                                    selectImage(event.target.files?.[0]);
                                    event.currentTarget.value = '';
                                }}
                            />
                        </label>
                        {options.coverImage && (
                            <button
                                type="button"
                                className="io-icon-btn"
                                onClick={() => onOptionChange('coverImage', null)}
                                aria-label={t('bookCoverRemoveImage')}
                                title={t('bookCoverRemoveImage')}
                            >
                                <span className="codicon codicon-close" aria-hidden="true" />
                            </button>
                        )}
                        {options.coverImage && (
                            <span className="book-cover-image__name">{options.coverImage.name}</span>
                        )}
                    </div>
                    {error && <span className="book-cover-image__error" role="alert">{error}</span>}
                </div>
            </div>
        </fieldset>
    );
}
