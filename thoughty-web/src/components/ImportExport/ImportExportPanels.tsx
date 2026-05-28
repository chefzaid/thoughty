import type { ChangeEvent, ReactNode, RefObject } from 'react';
import type { ImportExportFormat, ImportExportSection, TranslationFunction } from '../../types';
import { EXPORT_FORMAT_OPTIONS, type FormatConfig, type PreviewData } from './ImportExport.types';

const DATE_FORMAT_OPTIONS = ['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY'] as const;
const COUNTED_FIELDS: ReadonlyArray<{ key: 'entrySeparator' | 'sameDaySeparator'; labelKey: string }> = [
    { key: 'entrySeparator', labelKey: 'entrySeparator' },
    { key: 'sameDaySeparator', labelKey: 'sameDaySeparator' },
];
const COMPACT_FIELDS: ReadonlyArray<{ key: 'datePrefix' | 'dateSuffix' | 'tagOpenBracket' | 'tagCloseBracket' | 'tagSeparator'; labelKey: string; maxLength?: number }> = [
    { key: 'datePrefix', labelKey: 'datePrefix' },
    { key: 'dateSuffix', labelKey: 'dateSuffix' },
    { key: 'tagOpenBracket', labelKey: 'tagOpenBracket', maxLength: 2 },
    { key: 'tagCloseBracket', labelKey: 'tagCloseBracket', maxLength: 2 },
    { key: 'tagSeparator', labelKey: 'tagSeparator', maxLength: 2 },
];

export function RouteActions({
    activeSection,
    onSelectSection,
    onSelectJsonExport,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    onSelectSection: (section: ImportExportSection) => void;
    onSelectJsonExport: () => void;
    t: TranslationFunction;
}>) {
    return (
        <nav className="io-route-actions" aria-label={t('importExport')}>
            {(['export', 'import'] as const).map((section) => (
                <button
                    key={section}
                    type="button"
                    className={`io-btn ${activeSection === section ? 'primary' : 'secondary'}`}
                    onClick={() => onSelectSection(section)}
                >
                    {t(section)}
                </button>
            ))}
            <button type="button" className="io-btn secondary" onClick={onSelectJsonExport}>
                {t('formatJson')}
            </button>
        </nav>
    );
}

export function ExportSection({
    activeSection,
    sectionRef,
    diaryName,
    exportFormat,
    includeVisibility,
    onChangeExportFormat,
    onToggleIncludeVisibility,
    onExport,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    sectionRef: RefObject<HTMLElement | null>;
    diaryName?: string;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
    onChangeExportFormat: (format: ImportExportFormat) => void;
    onToggleIncludeVisibility: () => void;
    onExport: () => void;
    t: TranslationFunction;
}>) {
    return (
        <section ref={sectionRef} className={`io-section ${activeSection === 'export' ? 'is-route-target' : ''}`} id="export-section">
            <h3>{t('export')}</h3>
            <p className="section-description">{t('exportDescription', { diaryName: diaryName || '' })}</p>
            <div className="export-controls">
                <div className="export-option-row export-option-row--split">
                    <div className="export-option-group export-option-group--format">
                        <label>{t('exportFormat')}</label>
                        <select
                            value={exportFormat}
                            onChange={(event) => onChangeExportFormat(event.target.value as ImportExportFormat)}
                            className="format-select"
                        >
                            {EXPORT_FORMAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-option-group export-option-group--visibility">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={includeVisibility} onChange={onToggleIncludeVisibility} />
                            {t('includeVisibilityShort')}
                        </label>
                    </div>
                    <button className="io-btn primary" onClick={onExport}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {t('downloadExport')}
                    </button>
                </div>
            </div>
        </section>
    );
}

export function ImportSection({
    activeSection,
    sectionRef,
    diaryName,
    preview,
    skipDuplicates,
    importing,
    onFileSelect,
    onSetSkipDuplicates,
    onImport,
    cloudImportContent,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    sectionRef: RefObject<HTMLElement | null>;
    diaryName?: string;
    preview: PreviewData | null;
    skipDuplicates: boolean;
    importing: boolean;
    onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
    onSetSkipDuplicates: (value: boolean) => void;
    onImport: () => void;
    cloudImportContent?: ReactNode;
    t: TranslationFunction;
}>) {
    return (
        <section ref={sectionRef} className={`io-section ${activeSection === 'import' ? 'is-route-target' : ''}`} id="import-section">
            <h3>{t('import')}</h3>
            <p className="section-description">{t('importDescription', { diaryName: diaryName || '' })}</p>

            <div className="file-upload">
                <input type="file" id="file-input" accept=".txt,.json,.md" onChange={onFileSelect} />
                <label htmlFor="file-input" className="file-label">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t('chooseFile')}
                </label>
            </div>

            {preview && (
                <div className="preview-box">
                    <h4>{t('previewSummary')}</h4>
                    <div className="preview-stats">
                        <div className="stat">
                            <span className="stat-value">{preview.totalCount}</span>
                            <span className="stat-label">{t('entriesFound')}</span>
                        </div>
                        <div className={`stat ${preview.duplicateCount > 0 ? 'warning' : ''}`}>
                            <span className="stat-value">{preview.duplicateCount}</span>
                            <span className="stat-label">{t('duplicatesFound')}</span>
                        </div>
                    </div>

                    {preview.duplicateCount > 0 && (
                        <div className="duplicate-option">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={skipDuplicates} onChange={(event) => onSetSkipDuplicates(event.target.checked)} />
                                {t('skipDuplicates')}
                            </label>
                        </div>
                    )}

                    <button className="io-btn primary" onClick={onImport} disabled={importing}>
                        {importing ? t('importing') : t('confirmImport')}
                    </button>
                </div>
            )}

            {cloudImportContent}
        </section>
    );
}

export function FormatSection({
    formatConfig,
    onInputChange,
    onSave,
    t,
}: Readonly<{
    formatConfig: FormatConfig;
    onInputChange: (key: keyof FormatConfig, value: string) => void;
    onSave: () => void;
    t: TranslationFunction;
}>) {
    return (
        <section className="io-section format-section">
            <h3>{t('formatSettings')}</h3>
            <p className="section-description">{t('formatDescription')}</p>
            <div className="format-grid">
                <div className="format-row format-row--separators">
                    {COUNTED_FIELDS.map((field) => (
                        <div key={field.key} className="format-field">
                            <label>{t(field.labelKey)}</label>
                            <div className="input-with-count">
                                <input type="text" value={formatConfig[field.key]} onChange={(event) => onInputChange(field.key, event.target.value)} />
                                <span className="char-count">{formatConfig[field.key].length}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="format-row format-row--compact">
                    {COMPACT_FIELDS.map((field) => (
                        <div key={field.key} className="format-field format-field--compact">
                            <label>{t(field.labelKey)}</label>
                            <input
                                type="text"
                                value={formatConfig[field.key]}
                                onChange={(event) => onInputChange(field.key, event.target.value)}
                                maxLength={field.maxLength}
                            />
                        </div>
                    ))}
                    <div className="format-field format-field--compact">
                        <label>{t('dateFormat')}</label>
                        <select value={formatConfig.dateFormat} onChange={(event) => onInputChange('dateFormat', event.target.value)}>
                            {DATE_FORMAT_OPTIONS.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <button className="io-btn secondary" onClick={onSave}>{t('saveFormat')}</button>
        </section>
    );
}

export function DangerZoneSection({
    confirmDeleteAll,
    deleting,
    deleteAllLabel,
    diaryName,
    onCancelDelete,
    onDeleteAll,
    t,
}: Readonly<{
    confirmDeleteAll: boolean;
    deleting: boolean;
    deleteAllLabel: string;
    diaryName?: string;
    onCancelDelete: () => void;
    onDeleteAll: () => void;
    t: TranslationFunction;
}>) {
    return (
        <section className="io-section danger-zone">
            <h3>{t('dangerZone')}</h3>
            <p className="section-description">{t('deleteAllDescription', { diaryName: diaryName || '' })}</p>
            <div className="danger-actions">
                {confirmDeleteAll && (
                    <button className="io-btn secondary" onClick={onCancelDelete}>{t('cancel')}</button>
                )}
                <button className="io-btn danger" onClick={onDeleteAll} disabled={deleting}>{deleteAllLabel}</button>
            </div>
        </section>
    );
}