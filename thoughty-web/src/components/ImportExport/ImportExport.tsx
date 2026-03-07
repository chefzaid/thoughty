import React, { useState, useEffect, ChangeEvent } from 'react';
import './ImportExport.css';
import { useAuth } from '../../contexts/AuthContext';

interface FormatConfig {
    entrySeparator: string;
    sameDaySeparator: string;
    datePrefix: string;
    dateSuffix: string;
    dateFormat: string;
    tagOpenBracket: string;
    tagCloseBracket: string;
    tagSeparator: string;
}

interface PreviewData {
    totalCount: number;
    duplicateCount: number;
}

interface MessageState {
    type: 'success' | 'error';
    text: string;
}

interface ImportExportProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
    readonly diaryName?: string;
}

function ImportExport({ theme, t, diaryId, diaryName }: ImportExportProps): React.ReactElement {
    const { authFetch } = useAuth();
    const [formatConfig, setFormatConfig] = useState<FormatConfig>({
        entrySeparator: '--------------------------------------------------------------------------------',
        sameDaySeparator: '********************************************************************************',
        datePrefix: '---',
        dateSuffix: '--',
        dateFormat: 'YYYY-MM-DD',
        tagOpenBracket: '[',
        tagCloseBracket: ']',
        tagSeparator: ','
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [importing, setImporting] = useState<boolean>(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [message, setMessage] = useState<MessageState | null>(null);
    const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    const isLight = theme === 'light';

    // Fetch current format settings on mount
    useEffect(() => {
        fetchFormatSettings();
    }, []);

    const fetchFormatSettings = async (): Promise<void> => {
        try {
            const response = await authFetch('/api/io/format');
            if (response.ok) {
                const data = await response.json();
                setFormatConfig(data);
            }
        } catch (error) {
            console.error('Failed to fetch format settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveFormatSettings = async (): Promise<void> => {
        try {
            const response = await authFetch('/api/io/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formatConfig)
            });
            if (response.ok) {
                setMessage({ type: 'success', text: t('formatSaved') });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            console.error('Failed to save format settings:', error);
            setMessage({ type: 'error', text: t('formatSaveError') });
        }
    };

    const handleExport = async (): Promise<void> => {
        try {
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            const response = await authFetch(`/api/io/export?${params}`);
            if (response.ok) {
                const blob = await response.blob();
                const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
                    || `thoughty_export_${new Date().toISOString().split('T')[0]}.txt`;

                const url = globalThis.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                globalThis.URL.revokeObjectURL(url);
                a.remove();

                setMessage({ type: 'success', text: t('exportSuccess') });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            console.error('Export failed:', error);
            setMessage({ type: 'error', text: t('exportError') });
        }
    };

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            setFileContent(content);

            // Get preview
            const response = await authFetch('/api/io/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, diaryId })
            });
            if (response.ok) {
                const data = await response.json();
                setPreview(data);
            }
        } catch (error) {
            console.error('Preview failed:', error);
            setMessage({ type: 'error', text: t('previewError') });
        }
    };

    const handleImport = async (): Promise<void> => {
        if (!fileContent) return;

        setImporting(true);
        try {
            const response = await authFetch('/api/io/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: fileContent, skipDuplicates, diaryId })
            });
            if (response.ok) {
                const data = await response.json();
                setMessage({
                    type: 'success',
                    text: t('importSuccess', {
                        imported: data.importedCount,
                        skipped: data.skippedCount
                    })
                });
                setPreview(null);
                setFileContent('');
            }
        } catch (error) {
            console.error('Import failed:', error);
            setMessage({ type: 'error', text: t('importError') });
        } finally {
            setImporting(false);
        }
    };

    const handleInputChange = (key: keyof FormatConfig, value: string): void => {
        setFormatConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleDeleteAll = async (): Promise<void> => {
        if (!confirmDeleteAll) {
            setConfirmDeleteAll(true);
            return;
        }

        setDeleting(true);
        try {
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            const response = await authFetch(`/api/entries/all?${params}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setMessage({ type: 'success', text: t('deleteAllSuccess') });
                setConfirmDeleteAll(false);
            } else {
                setMessage({ type: 'error', text: t('deleteAllError') });
            }
        } catch (error) {
            console.error('Delete all failed:', error);
            setMessage({ type: 'error', text: t('deleteAllError') });
        } finally {
            setDeleting(false);
        }
    };

    let deleteAllLabel = t('deleteAllEntries');
    if (confirmDeleteAll) {
        deleteAllLabel = t('confirmDeleteAll');
    }
    if (deleting) {
        deleteAllLabel = t('deleting');
    }

    if (loading) {
        return <div className={`import-export ${isLight ? 'light' : 'dark'}`}>{t('loading')}...</div>;
    }

    return (
        <div className={`import-export ${isLight ? 'light' : 'dark'}`}>
            <h2>{t('importExport')}</h2>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="io-grid">
                {/* Export Section */}
                <section className="io-section">
                    <h3>{t('export')}</h3>
                    <p className="section-description">{t('exportDescription', { diaryName: diaryName || '' })}</p>
                    <button className="io-btn primary" onClick={handleExport}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {t('downloadExport')}
                    </button>
                </section>

                {/* Import Section */}
                <section className="io-section">
                    <h3>{t('import')}</h3>
                    <p className="section-description">{t('importDescription', { diaryName: diaryName || '' })}</p>

                    <div className="file-upload">
                        <input
                            type="file"
                            id="file-input"
                            accept=".txt"
                            onChange={handleFileSelect}
                        />
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
                                        <input
                                            type="checkbox"
                                            checked={skipDuplicates}
                                            onChange={(e) => setSkipDuplicates(e.target.checked)}
                                        />
                                        {t('skipDuplicates')}
                                    </label>
                                </div>
                            )}

                            <button
                                className="io-btn primary"
                                onClick={handleImport}
                                disabled={importing}
                            >
                                {importing ? t('importing') : t('confirmImport')}
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {/* Format Configuration Section */}
            <section className="io-section format-section">
                <h3>{t('formatSettings')}</h3>
                <p className="section-description">{t('formatDescription')}</p>

                <div className="format-grid">
                    <div className="format-row format-row--separators">
                        <div className="format-field">
                            <label>{t('entrySeparator')}</label>
                            <div className="input-with-count">
                                <input
                                    type="text"
                                    value={formatConfig.entrySeparator}
                                    onChange={(e) => handleInputChange('entrySeparator', e.target.value)}
                                />
                                <span className="char-count">{formatConfig.entrySeparator.length}</span>
                            </div>
                        </div>
                        <div className="format-field">
                            <label>{t('sameDaySeparator')}</label>
                            <div className="input-with-count">
                                <input
                                    type="text"
                                    value={formatConfig.sameDaySeparator}
                                    onChange={(e) => handleInputChange('sameDaySeparator', e.target.value)}
                                />
                                <span className="char-count">{formatConfig.sameDaySeparator.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="format-row format-row--compact">
                        <div className="format-field format-field--compact">
                            <label>{t('datePrefix')}</label>
                            <input
                                type="text"
                                value={formatConfig.datePrefix}
                                onChange={(e) => handleInputChange('datePrefix', e.target.value)}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('dateSuffix')}</label>
                            <input
                                type="text"
                                value={formatConfig.dateSuffix}
                                onChange={(e) => handleInputChange('dateSuffix', e.target.value)}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagOpenBracket')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagOpenBracket}
                                onChange={(e) => handleInputChange('tagOpenBracket', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagCloseBracket')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagCloseBracket}
                                onChange={(e) => handleInputChange('tagCloseBracket', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagSeparator')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagSeparator}
                                onChange={(e) => handleInputChange('tagSeparator', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('dateFormat')}</label>
                            <select
                                value={formatConfig.dateFormat}
                                onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                            >
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                                <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button className="io-btn secondary" onClick={saveFormatSettings}>
                    {t('saveFormat')}
                </button>
            </section>

            {/* Danger Zone */}
            <section className="io-section danger-zone">
                <h3>{t('dangerZone')}</h3>
                <p className="section-description">{t('deleteAllDescription', { diaryName: diaryName || '' })}</p>
                <div className="danger-actions">
                    {confirmDeleteAll && (
                        <button
                            className="io-btn secondary"
                            onClick={() => setConfirmDeleteAll(false)}
                        >
                            {t('cancel')}
                        </button>
                    )}
                    <button
                        className="io-btn danger"
                        onClick={handleDeleteAll}
                        disabled={deleting}
                    >
                        {deleteAllLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default ImportExport;
