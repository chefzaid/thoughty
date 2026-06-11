import type { RefObject } from 'react';
import type { ImportExportSection, TranslationFunction } from '../../types';
import {
    BOOK_CHAPTER_ORDER_OPTIONS,
    BOOK_FORMAT_OPTIONS,
    BOOK_TAG_SCOPE_OPTIONS,
    type BookChapterOrder,
    type BookFormat,
    type BookOptions,
    type BookPreviewData,
    type BookTagScope,
} from './ImportExport.types';

const BOOK_CHECKBOXES: ReadonlyArray<{ key: 'narrative' | 'includeUntagged' | 'includeDates' | 'includeToc'; labelKey: string }> = [
    { key: 'narrative', labelKey: 'bookNarrative' },
    { key: 'includeUntagged', labelKey: 'bookIncludeUntagged' },
    { key: 'includeDates', labelKey: 'bookIncludeDates' },
    { key: 'includeToc', labelKey: 'bookIncludeToc' },
];

export function BookSection({
    activeSection,
    sectionRef,
    diaryName,
    options,
    preview,
    generating,
    onOptionChange,
    onPreview,
    onDownload,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    sectionRef: RefObject<HTMLElement | null>;
    diaryName?: string;
    options: BookOptions;
    preview: BookPreviewData | null;
    generating: boolean;
    onOptionChange: <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;
    onPreview: () => void;
    onDownload: () => void;
    t: TranslationFunction;
}>) {
    return (
        <section ref={sectionRef} className={`io-section ${activeSection === 'book' ? 'is-route-target' : ''}`} id="book-section">
            <h3>{t('book')}</h3>
            <p className="section-description">{t('bookDescription', { diaryName: diaryName || '' })}</p>

            <div className="export-controls">
                <div className="export-option-row export-option-row--split">
                    <div className="export-option-group">
                        <label htmlFor="book-title">{t('bookTitleLabel')}</label>
                        <input
                            id="book-title"
                            type="text"
                            value={options.title}
                            placeholder={t('bookTitlePlaceholder')}
                            maxLength={200}
                            onChange={(event) => onOptionChange('title', event.target.value)}
                        />
                    </div>
                    <div className="export-option-group">
                        <label htmlFor="book-author">{t('bookAuthorLabel')}</label>
                        <input
                            id="book-author"
                            type="text"
                            value={options.author}
                            placeholder={t('bookAuthorPlaceholder')}
                            maxLength={200}
                            onChange={(event) => onOptionChange('author', event.target.value)}
                        />
                    </div>
                </div>

                <div className="export-option-row export-option-row--split">
                    <div className="export-option-group export-option-group--format">
                        <label htmlFor="book-format">{t('exportFormat')}</label>
                        <select
                            id="book-format"
                            value={options.format}
                            onChange={(event) => onOptionChange('format', event.target.value as BookFormat)}
                            className="format-select"
                        >
                            {BOOK_FORMAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group">
                        <label htmlFor="book-chapter-order">{t('bookChapterOrder')}</label>
                        <select
                            id="book-chapter-order"
                            value={options.chapterOrder}
                            onChange={(event) => onOptionChange('chapterOrder', event.target.value as BookChapterOrder)}
                            className="format-select"
                        >
                            {BOOK_CHAPTER_ORDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group">
                        <label htmlFor="book-tag-scope">{t('bookTagScope')}</label>
                        <select
                            id="book-tag-scope"
                            value={options.tagScope}
                            onChange={(event) => onOptionChange('tagScope', event.target.value as BookTagScope)}
                            className="format-select"
                        >
                            {BOOK_TAG_SCOPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="export-option-row">
                    {BOOK_CHECKBOXES.map((checkbox) => (
                        <label key={checkbox.key} className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={options[checkbox.key]}
                                onChange={(event) => onOptionChange(checkbox.key, event.target.checked)}
                            />
                            {t(checkbox.labelKey)}
                        </label>
                    ))}
                </div>

                <div className="export-option-row">
                    <button className="io-btn secondary" onClick={onPreview}>
                        {t('previewBook')}
                    </button>
                    <button className="io-btn primary" onClick={onDownload} disabled={generating}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {generating ? t('generatingBook') : t('downloadBook')}
                    </button>
                </div>
            </div>

            {preview && (
                <div className="preview-box">
                    <h4>{t('bookOutline')}</h4>
                    <div className="preview-stats">
                        <div className="stat">
                            <span className="stat-value">{preview.chapterCount}</span>
                            <span className="stat-label">{t('bookChaptersCount')}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{preview.entryCount}</span>
                            <span className="stat-label">{t('bookEntriesCount')}</span>
                        </div>
                    </div>
                    {preview.chapters.length === 0 ? (
                        <p className="section-description">{t('bookNoChapters')}</p>
                    ) : (
                        <ol className="book-chapter-list">
                            {preview.chapters.map((chapter) => (
                                <li key={chapter.title}>
                                    {chapter.title}
                                    {' '}
                                    <span className="book-chapter-meta">
                                        ({chapter.entryCount} · {chapter.firstDate} → {chapter.lastDate})
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}
        </section>
    );
}
