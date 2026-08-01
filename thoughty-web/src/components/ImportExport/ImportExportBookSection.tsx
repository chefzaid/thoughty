import type { RefObject } from 'react';
import type { ImportExportSection, TranslationFunction } from '../../types';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';
import './ImportExportBookSection.css';
import {
    BOOK_CHAPTER_MODE_OPTIONS,
    BOOK_CHAPTER_ORDER_OPTIONS,
    BOOK_FORMAT_OPTIONS,
    BOOK_TAG_SCOPE_OPTIONS,
    BOOK_WEAVING_MODE_OPTIONS,
    type BookChapterMode,
    type BookChapterOrder,
    type BookFormat,
    type BookOptions,
    type BookPreviewData,
    type BookTagScope,
    type BookVersionData,
    type BookWeavingMode,
} from './ImportExport.types';
import { BookCoverControls } from './ImportExportBookCover';

const BOOK_CHECKBOXES: ReadonlyArray<{
    key: 'narrative' | 'chapterFraming' | 'embedImages' | 'includeUntagged' | 'includeDates' | 'includeToc';
    labelKey: string;
}> = [
    { key: 'narrative', labelKey: 'bookNarrative' },
    { key: 'chapterFraming', labelKey: 'bookChapterFraming' },
    { key: 'embedImages', labelKey: 'bookEmbedImages' },
    { key: 'includeUntagged', labelKey: 'bookIncludeUntagged' },
    { key: 'includeDates', labelKey: 'bookIncludeDates' },
    { key: 'includeToc', labelKey: 'bookIncludeToc' },
];

const BOOK_PROGRESS_STEPS = [35, 68, 92] as const;

export function BookSection({
    activeSection,
    sectionRef,
    diaryName,
    options,
    preview,
    generating,
    uploading,
    savingVersion,
    versions,
    downloadingVersionId,
    connectedProviders,
    cloudProvider,
    onOptionChange,
    onCloudProviderChange,
    onPreview,
    onDownload,
    onUpload,
    onCreateVersion,
    onVersionDownload,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    sectionRef: RefObject<HTMLElement | null>;
    diaryName?: string;
    options: BookOptions;
    preview: BookPreviewData | null;
    generating: boolean;
    uploading: boolean;
    savingVersion: boolean;
    versions: BookVersionData[];
    downloadingVersionId: number | null;
    connectedProviders: CloudProviderType[];
    cloudProvider: CloudProviderType | '';
    onOptionChange: <K extends keyof BookOptions>(key: K, value: BookOptions[K]) => void;
    onCloudProviderChange: (provider: CloudProviderType | '') => void;
    onPreview: () => void;
    onDownload: () => void;
    onUpload: () => void;
    onCreateVersion: () => void;
    onVersionDownload: (version: BookVersionData) => void;
    t: TranslationFunction;
}>) {
    const progressLabel = savingVersion
        ? t('savingBookVersion')
        : t(uploading ? 'uploadingBook' : 'generatingBook');

    return (
        <section ref={sectionRef} className={`io-section ${activeSection === 'book' ? 'is-route-target' : ''}`} id="book-section">
            <h3>{t('book')}</h3>
            <p className="section-description">{t('bookDescription', { diaryName: diaryName || '' })}</p>

            <div className="export-controls book-controls">
                <div className="book-options-grid book-options-grid--title">
                    <div className="export-option-group book-field">
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
                    <div className="export-option-group book-field">
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

                <BookCoverControls options={options} onOptionChange={onOptionChange} t={t} />

                <div className="book-options-grid book-options-grid--settings">
                    <div className="export-option-group export-option-group--format book-field">
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
                    <div className="export-option-group book-field">
                        <label htmlFor="book-chapter-mode">{t('bookChapterMode')}</label>
                        <select
                            id="book-chapter-mode"
                            value={options.chapterMode}
                            onChange={(event) => onOptionChange('chapterMode', event.target.value as BookChapterMode)}
                            className="format-select"
                        >
                            {BOOK_CHAPTER_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group book-field">
                        <label htmlFor="book-chapter-order">{t('bookChapterOrder')}</label>
                        <select
                            id="book-chapter-order"
                            value={options.chapterOrder}
                            onChange={(event) => onOptionChange('chapterOrder', event.target.value as BookChapterOrder)}
                            className="format-select"
                            disabled={options.chapterMode !== 'tags'}
                        >
                            {BOOK_CHAPTER_ORDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group book-field">
                        <label htmlFor="book-tag-scope">{t('bookTagScope')}</label>
                        <select
                            id="book-tag-scope"
                            value={options.tagScope}
                            onChange={(event) => onOptionChange('tagScope', event.target.value as BookTagScope)}
                            className="format-select"
                            disabled={options.chapterMode !== 'tags'}
                        >
                            {BOOK_TAG_SCOPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group book-field">
                        <label htmlFor="book-weaving-mode">{t('bookWeavingMode')}</label>
                        <select
                            id="book-weaving-mode"
                            value={options.weavingMode}
                            onChange={(event) => onOptionChange('weavingMode', event.target.value as BookWeavingMode)}
                            className="format-select"
                            disabled={!options.narrative}
                        >
                            {BOOK_WEAVING_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="export-option-row book-checkbox-row">
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

                {generating && (
                    <div className="book-progress" role="progressbar" aria-valuetext={progressLabel}>
                        <div className="book-progress__track">
                            {BOOK_PROGRESS_STEPS.map((step) => (
                                <span key={step} className="book-progress__marker" style={{ left: `${step}%` }} />
                            ))}
                            <span className="book-progress__bar" />
                        </div>
                        <span className="book-progress__label">{progressLabel}</span>
                    </div>
                )}

                <div className="export-option-row book-action-row">
                    <button className="io-btn secondary" onClick={onPreview} disabled={generating}>
                        {t('previewBook')}
                    </button>
                    <button className="io-btn primary" onClick={onDownload} disabled={generating}>
                        <span className="codicon codicon-cloud-download" aria-hidden="true" />
                        {generating && !uploading && !savingVersion ? t('generatingBook') : t('downloadBook')}
                    </button>
                    <button className="io-btn secondary" onClick={onCreateVersion} disabled={generating}>
                        <span className="codicon codicon-history" aria-hidden="true" />
                        {versions.length > 0 ? t('updateBookVersion') : t('createBookVersion')}
                    </button>
                </div>

                <div className="book-cloud-row">
                    <div className="export-option-group book-field book-cloud-provider">
                        <label htmlFor="book-cloud-provider">{t('bookCloudProvider')}</label>
                        <select
                            id="book-cloud-provider"
                            className="format-select"
                            value={cloudProvider}
                            disabled={connectedProviders.length === 0 || generating}
                            onChange={(event) => onCloudProviderChange(event.target.value as CloudProviderType)}
                        >
                            {connectedProviders.length === 0 && (
                                <option value="">{t('bookCloudProviderPlaceholder')}</option>
                            )}
                            {connectedProviders.map((provider) => (
                                <option key={provider} value={provider}>{CLOUD_PROVIDER_NAMES[provider]}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="io-btn secondary book-cloud-upload"
                        onClick={onUpload}
                        disabled={!cloudProvider || generating}
                    >
                        <span className="codicon codicon-cloud-upload" aria-hidden="true" />
                        {uploading ? t('uploadingBook') : t('uploadBook')}
                    </button>
                    {connectedProviders.length === 0 && (
                        <span className="book-cloud-hint">{t('bookCloudConnectHint')}</span>
                    )}
                </div>
            </div>

            <div className="book-version-history">
                <h4>{t('bookVersionHistory')}</h4>
                {versions.length === 0 ? (
                    <p className="section-description">{t('bookVersionEmpty')}</p>
                ) : (
                    <ol className="book-version-list">
                        {versions.map((version) => (
                            <li key={version.id} className="book-version-item">
                                <div className="book-version-item__main">
                                    <strong>{t('bookVersionNumber', { version: version.versionNumber })}</strong>
                                    <span>{version.title}</span>
                                    <span className="book-version-item__meta">
                                        {version.format.toUpperCase()} · {version.createdAt.slice(0, 10)} · {' '}
                                        {t('bookVersionCounts', {
                                            chapters: version.chapterCount,
                                            entries: version.entryCount,
                                        })}
                                    </span>
                                    <span className="book-version-item__changes">
                                        {t('bookVersionChanges', {
                                            entries: version.addedEntryCount,
                                            chapters: version.addedChapterTitles.length,
                                        })}
                                        {version.addedChapterTitles.length > 0 && `: ${version.addedChapterTitles.join(', ')}`}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="io-icon-btn"
                                    aria-label={t('downloadBookVersion', { version: version.versionNumber })}
                                    title={t('downloadBookVersion', { version: version.versionNumber })}
                                    disabled={downloadingVersionId !== null}
                                    onClick={() => onVersionDownload(version)}
                                >
                                    <span className={`codicon codicon-${downloadingVersionId === version.id ? 'loading codicon-modifier-spin' : 'cloud-download'}`} aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
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
