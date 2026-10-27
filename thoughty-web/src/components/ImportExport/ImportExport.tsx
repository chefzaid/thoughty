import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import './ImportExport.css';
import { useAuth } from '../../contexts/AuthContext';
import type { ImportExportFormat, ImportExportSection } from '../../types';
import { CloudImportSection, CloudSyncSection } from './ImportExportCloudSection';
import { DangerZoneSection, ExportSection, FormatSection, ImportSection, RouteActions } from './ImportExportPanels';
import { ImportExportBookPanel } from './ImportExportBookPanel';
import { AppImportPanel } from './appImport/AppImportPanel';
import { useImportExportCloud } from './useImportExportCloud';
import AutoDismiss from '../AutoDismiss/AutoDismiss';
import { useTransientMessage } from '../../hooks/useTransientMessage';
import { downloadBlob } from '../../utils/downloadFile';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { readApiErrorMessage } from '../../services/api/base';
import {
    DEFAULT_FORMAT_CONFIG,
    type FormatConfig,
    type ImportExportProps,
    type ImportExportRouteState,
    type MessageState,
    type PreviewData,
} from './ImportExport.types';

function ImportExport({
    theme,
    t,
    language = 'en',
    diaryId,
    diaryName,
    onDiariesChanged,
    initialSection = 'export',
    initialExportFormat = 'txt',
    initialIncludeVisibility = false,
    initialBookEntryIds,
    onRouteStateChange,
}: Readonly<ImportExportProps>) {
    const { authFetch } = useAuth();
    const [formatConfig, setFormatConfig] = useState<FormatConfig>(DEFAULT_FORMAT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [message, setMessage] = useState<MessageState | null>(null);
    const messageToast = useTransientMessage();
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [includeVisibility, setIncludeVisibility] = useState(initialIncludeVisibility);
    const [exportFormat, setExportFormat] = useState<ImportExportFormat>(initialExportFormat);
    const [activeSection, setActiveSection] = useState<ImportExportSection>(initialSection);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const exportSectionRef = useRef<HTMLElement | null>(null);
    const importSectionRef = useRef<HTMLElement | null>(null);
    const bookSectionRef = useRef<HTMLElement | null>(null);
    const isLight = theme === 'light';

    function showMessage(type: MessageState['type'], text: string, durationMs = 4000): void {
        setMessage({ type, text, durationMs });
        messageToast.show();
    }

    /** A message with a duration hides itself after it; one without (the import summary) stays until the next. */
    function renderMessage({ type, text, durationMs }: MessageState) {
        const banner = <div className={`message ${type}`}>{text}</div>;
        if (durationMs === undefined) return banner;
        return <AutoDismiss message={messageToast} durationMs={durationMs}>{banner}</AutoDismiss>;
    }

    function emitRouteState(nextState: Partial<ImportExportRouteState> = {}): void {
        onRouteStateChange?.({
            section: nextState.section ?? activeSection,
            exportFormat: nextState.exportFormat ?? exportFormat,
            includeVisibility: nextState.includeVisibility ?? includeVisibility,
        });
    }

    useEffect(() => {
        setActiveSection(initialSection);
    }, [initialSection]);

    useEffect(() => {
        setExportFormat(initialExportFormat);
    }, [initialExportFormat]);

    useEffect(() => {
        setIncludeVisibility(initialIncludeVisibility);
    }, [initialIncludeVisibility]);

    useEffect(() => {
        const sectionRefs = {
            export: exportSectionRef,
            import: importSectionRef,
            book: bookSectionRef,
        } as const;
        const target = sectionRefs[activeSection].current;
        if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }, [activeSection]);

    useEffect(() => {
        void (async () => {
            try {
                const response = await authFetch('/api/io/format');
                if (response.ok) {
                    setFormatConfig(await response.json() as FormatConfig);
                }
            } catch (error) {
                console.error('Failed to fetch format settings:', error);
            } finally {
                setLoading(false);
            }
        })();
    }, [authFetch]);

    async function previewImportContent(content: string, successText?: string): Promise<void> {
        setFileContent(content);
        try {
            const response = await authFetch('/api/io/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, diaryId }),
            });
            if (!response.ok) {
                showMessage('error', t(await readApiErrorMessage(response, 'previewError')));
                return;
            }

            setPreview(await response.json());
            if (successText) {
                showMessage('success', successText);
            }
        } catch (error) {
            console.error('Preview failed:', error);
            showMessage('error', t('previewError'));
        }
    }

    const cloud = useImportExportCloud({ diaryId, showMessage, previewImportContent, t });

    async function saveFormatSettings(): Promise<void> {
        try {
            const response = await authFetch('/api/io/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formatConfig),
            });
            if (!response.ok) {
                showMessage('error', t(await readApiErrorMessage(response, 'formatSaveError')));
                return;
            }
            showMessage('success', t('formatSaved'), 3000);
        } catch (error) {
            console.error('Failed to save format settings:', error);
            showMessage('error', t('formatSaveError'));
        }
    }

    async function handleExport(): Promise<void> {
        try {
            const params = new URLSearchParams();
            if (diaryId) {
                params.append('diaryId', diaryId.toString());
            }
            if (includeVisibility) {
                params.append('includeVisibility', 'true');
            }
            if (exportFormat !== 'txt') {
                params.append('format', exportFormat);
            }

            const response = await authFetch(`/api/io/export?${params}`);
            if (!response.ok) {
                showMessage('error', t(await readApiErrorMessage(response, 'exportError')));
                return;
            }

            const blob = await response.blob();
            const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
                || `thoughty_export_${new Date().toISOString().split('T')[0]}.txt`;
            downloadBlob(blob, filename);

            showMessage('success', t('exportSuccess'), 3000);
        } catch (error) {
            console.error('Export failed:', error);
            showMessage('error', t('exportError'));
        }
    }

    async function handleFileSelect(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            await previewImportContent(await file.text());
        } catch (error) {
            console.error('Preview failed:', error);
            showMessage('error', t('previewError'));
        }
    }

    async function handleImport(): Promise<void> {
        if (!fileContent) {
            return;
        }

        setImporting(true);
        try {
            const response = await authFetch('/api/io/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: fileContent, skipDuplicates, diaryId }),
            });
            if (!response.ok) {
                showMessage('error', t(await readApiErrorMessage(response, 'importError')));
                return;
            }

            const data = await response.json();
            setMessage({
                type: 'success',
                text: pluralPhrase(t, 'importSuccess', data.importedCount, language, {
                    skipped: pluralPhrase(t, 'importDuplicatesSkipped', data.skippedCount, language),
                }),
            });
            setPreview(null);
            setFileContent('');
        } catch (error) {
            console.error('Import failed:', error);
            showMessage('error', t('importError'));
        } finally {
            setImporting(false);
        }
    }

    function handleInputChange(key: keyof FormatConfig, value: string): void {
        setFormatConfig((current) => ({ ...current, [key]: value }));
    }

    async function handleDeleteAll(): Promise<void> {
        if (!confirmDeleteAll) {
            setConfirmDeleteAll(true);
            return;
        }

        setDeleting(true);
        try {
            const params = new URLSearchParams();
            if (diaryId) {
                params.append('diaryId', diaryId.toString());
            }
            const response = await authFetch(`/api/entries/all?${params}`, { method: 'DELETE' });
            if (response.ok) {
                showMessage('success', t('deleteAllSuccess'));
                setConfirmDeleteAll(false);
            } else {
                showMessage('error', t(await readApiErrorMessage(response, 'deleteAllError')));
            }
        } catch (error) {
            console.error('Delete all failed:', error);
            showMessage('error', t('deleteAllError'));
        } finally {
            setDeleting(false);
        }
    }

    let deleteAllLabel = t('deleteAllEntries');
    if (deleting) {
        deleteAllLabel = t('deleting');
    } else if (confirmDeleteAll) {
        deleteAllLabel = t('confirmDeleteAll');
    }

    if (loading) {
        return <div className={`import-export ${isLight ? 'light' : 'dark'}`}>{t('loading')}...</div>;
    }

    return (
        <div className={`import-export ${isLight ? 'light' : 'dark'}`}>
            <h2>{t('importExport')}</h2>

            <RouteActions
                activeSection={activeSection}
                onSelectSection={(section) => {
                    setActiveSection(section);
                    emitRouteState({ section });
                }}
                t={t}
            />

            {message && renderMessage(message)}

            <div className="io-grid">
                <ExportSection
                    activeSection={activeSection}
                    sectionRef={exportSectionRef}
                    diaryName={diaryName}
                    exportFormat={exportFormat}
                    includeVisibility={includeVisibility}
                    onChangeExportFormat={(nextFormat) => {
                        setExportFormat(nextFormat);
                        emitRouteState({ exportFormat: nextFormat });
                    }}
                    onToggleIncludeVisibility={() => {
                        const nextValue = !includeVisibility;
                        setIncludeVisibility(nextValue);
                        emitRouteState({ includeVisibility: nextValue });
                    }}
                    onExport={handleExport}
                    t={t}
                />
                <ImportSection
                    activeSection={activeSection}
                    sectionRef={importSectionRef}
                    diaryName={diaryName}
                    preview={preview}
                    skipDuplicates={skipDuplicates}
                    importing={importing}
                    onFileSelect={handleFileSelect}
                    onSetSkipDuplicates={setSkipDuplicates}
                    onImport={handleImport}
                    appImportContent={(
                        <AppImportPanel
                            diaryId={diaryId}
                            diaryName={diaryName}
                            language={language}
                            onImported={onDiariesChanged}
                            t={t}
                        />
                    )}
                    cloudImportContent={<CloudImportSection {...cloud.importProps} t={t} />}
                    t={t}
                />
            </div>

            <ImportExportBookPanel
                activeSection={activeSection}
                sectionRef={bookSectionRef}
                diaryName={diaryName}
                diaryId={diaryId}
                initialEntryIds={initialBookEntryIds}
                authFetch={authFetch}
                connectedProviders={cloud.connectedProviders}
                language={language}
                showMessage={showMessage}
                t={t}
            />

            <CloudSyncSection {...cloud.syncProps} t={t} />

            <FormatSection formatConfig={formatConfig} onInputChange={handleInputChange} onSave={saveFormatSettings} t={t} />

            <DangerZoneSection
                confirmDeleteAll={confirmDeleteAll}
                deleting={deleting}
                deleteAllLabel={deleteAllLabel}
                diaryName={diaryName}
                onCancelDelete={() => setConfirmDeleteAll(false)}
                onDeleteAll={handleDeleteAll}
                t={t}
            />
        </div>
    );
}

export default ImportExport;
