import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import './ImportExport.css';
import { useAuth } from '../../contexts/AuthContext';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudExportFormat, ImportExportFormat, ImportExportSection } from '../../types';
import type { CloudFileInfo, CloudProviderType, CloudStatus, SyncFrequency, SyncScheduleConfig } from '../../services/api/cloudSyncService';
import { CloudImportSection, CloudSyncSection } from './ImportExportCloudSection';
import { DangerZoneSection, ExportSection, FormatSection, ImportSection, RouteActions } from './ImportExportPanels';
import { BookSection } from './ImportExportBookSection';
import { downloadBlob } from '../../utils/downloadFile';
import {
    CLOUD_PROVIDERS,
    DEFAULT_BOOK_OPTIONS,
    DEFAULT_FORMAT_CONFIG,
    createProviderRecord,
    type BookOptions,
    type BookPreviewData,
    type FormatConfig,
    type ImportExportProps,
    type ImportExportRouteState,
    type MessageState,
    type PreviewData,
} from './ImportExport.types';

function ImportExport({
    theme,
    t,
    diaryId,
    diaryName,
    initialSection = 'export',
    initialExportFormat = 'txt',
    initialIncludeVisibility = false,
    onRouteStateChange,
}: Readonly<ImportExportProps>) {
    const { authFetch } = useAuth();
    const { cloudSyncService } = useApiServices();

    const [formatConfig, setFormatConfig] = useState<FormatConfig>(DEFAULT_FORMAT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [message, setMessage] = useState<MessageState | null>(null);
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [includeVisibility, setIncludeVisibility] = useState(initialIncludeVisibility);
    const [exportFormat, setExportFormat] = useState<ImportExportFormat>(initialExportFormat);
    const [activeSection, setActiveSection] = useState<ImportExportSection>(initialSection);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [bookOptions, setBookOptions] = useState<BookOptions>(DEFAULT_BOOK_OPTIONS);
    const [bookPreview, setBookPreview] = useState<BookPreviewData | null>(null);
    const [generatingBook, setGeneratingBook] = useState(false);

    const [cloudStatus, setCloudStatus] = useState<Partial<CloudStatus>>({});
    const [cloudLoading, setCloudLoading] = useState(true);
    const [uploading, setUploading] = useState<CloudProviderType | null>(null);
    const [syncing, setSyncing] = useState<CloudProviderType | null>(null);
    const [schedules, setSchedules] = useState<Record<string, SyncScheduleConfig>>({});
    const [scheduleFrequency, setScheduleFrequency] = useState<Record<string, SyncFrequency>>(createProviderRecord('daily'));
    const [scheduleFormat, setScheduleFormat] = useState<Record<string, CloudExportFormat>>(createProviderRecord('txt'));
    const [scheduleIncludeVisibility, setScheduleIncludeVisibility] = useState<Record<string, boolean>>(createProviderRecord(false));
    const [cloudExportFormat, setCloudExportFormat] = useState<CloudExportFormat>('txt');
    const [cloudIncludeVisibility, setCloudIncludeVisibility] = useState(false);
    const [cloudImportProvider, setCloudImportProvider] = useState<CloudProviderType | null>(null);
    const [cloudFiles, setCloudFiles] = useState<CloudFileInfo[]>([]);
    const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
    const [importingCloudFile, setImportingCloudFile] = useState<string | null>(null);

    const exportSectionRef = useRef<HTMLElement | null>(null);
    const importSectionRef = useRef<HTMLElement | null>(null);
    const bookSectionRef = useRef<HTMLElement | null>(null);
    const isLight = theme === 'light';

    function showMessage(type: MessageState['type'], text: string, duration = 4000): void {
        setMessage({ type, text });
        globalThis.setTimeout(() => setMessage(null), duration);
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
                    setFormatConfig(await response.json());
                }
            } catch (error) {
                console.error('Failed to fetch format settings:', error);
            } finally {
                setLoading(false);
            }
        })();
    }, [authFetch]);

    const fetchCloudStatus = useCallback(async (): Promise<void> => {
        const data = await cloudSyncService.getStatus();
        if (data) {
            setCloudStatus(data);
        }
        setCloudLoading(false);
    }, [cloudSyncService]);

    const fetchSchedules = useCallback(async (): Promise<void> => {
        const data = await cloudSyncService.getSchedules();
        if (!data) {
            return;
        }

        setSchedules(data);
        const nextFrequency = createProviderRecord<SyncFrequency>('daily');
        const nextFormat = createProviderRecord<CloudExportFormat>('txt');
        const nextIncludeVisibility = createProviderRecord(false);

        for (const provider of CLOUD_PROVIDERS) {
            const config = data[provider];
            if (!config) {
                continue;
            }
            if (config.frequency) {
                nextFrequency[provider] = config.frequency;
            }
            if (config.format) {
                nextFormat[provider] = config.format as CloudExportFormat;
            }
            if (config.includeVisibility !== undefined) {
                nextIncludeVisibility[provider] = config.includeVisibility;
            }
        }

        setScheduleFrequency(nextFrequency);
        setScheduleFormat(nextFormat);
        setScheduleIncludeVisibility(nextIncludeVisibility);
    }, [cloudSyncService]);

    useEffect(() => {
        void fetchCloudStatus();
        void fetchSchedules();
    }, [fetchCloudStatus, fetchSchedules]);

    async function previewImportContent(content: string, successText?: string): Promise<void> {
        setFileContent(content);
        try {
            const response = await authFetch('/api/io/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, diaryId }),
            });
            if (!response.ok) {
                showMessage('error', t('previewError'));
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

    async function saveFormatSettings(): Promise<void> {
        try {
            const response = await authFetch('/api/io/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formatConfig),
            });
            if (response.ok) {
                showMessage('success', t('formatSaved'), 3000);
            }
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

    function buildBookParams(): URLSearchParams {
        const params = new URLSearchParams();
        if (diaryId) {
            params.append('diaryId', diaryId.toString());
        }
        if (bookOptions.title.trim()) {
            params.append('title', bookOptions.title.trim());
        }
        if (bookOptions.author.trim()) {
            params.append('author', bookOptions.author.trim());
        }
        if (bookOptions.format !== 'pdf') {
            params.append('format', bookOptions.format);
        }
        if (bookOptions.chapterMode !== 'tags') {
            params.append('chapterMode', bookOptions.chapterMode);
        }
        if (bookOptions.chapterOrder !== 'alpha') {
            params.append('chapterOrder', bookOptions.chapterOrder);
        }
        if (bookOptions.tagScope !== 'all') {
            params.append('tagScope', bookOptions.tagScope);
        }
        if (bookOptions.weavingMode !== 'strict') {
            params.append('weavingMode', bookOptions.weavingMode);
        }
        if (!bookOptions.includeUntagged) {
            params.append('includeUntagged', 'false');
        }
        if (!bookOptions.includeDates) {
            params.append('includeDates', 'false');
        }
        if (!bookOptions.includeToc) {
            params.append('includeToc', 'false');
        }
        if (!bookOptions.narrative) {
            params.append('narrative', 'false');
        }
        return params;
    }

    function handleBookOptionChange<K extends keyof BookOptions>(key: K, value: BookOptions[K]): void {
        setBookOptions((current) => ({ ...current, [key]: value }));
    }

    async function handleBookPreview(): Promise<void> {
        try {
            const response = await authFetch(`/api/books/preview?${buildBookParams()}`);
            if (!response.ok) {
                showMessage('error', t('bookPreviewError'));
                return;
            }
            setBookPreview(await response.json());
        } catch (error) {
            console.error('Book preview failed:', error);
            showMessage('error', t('bookPreviewError'));
        }
    }

    async function handleBookDownload(): Promise<void> {
        setGeneratingBook(true);
        try {
            const response = await authFetch(`/api/books/export?${buildBookParams()}`);
            if (!response.ok) {
                showMessage('error', t('bookExportError'));
                return;
            }

            const blob = await response.blob();
            const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
                || `thoughty_book_${new Date().toISOString().split('T')[0]}.${bookOptions.format}`;
            downloadBlob(blob, filename);

            showMessage('success', t('bookExportSuccess'), 3000);
        } catch (error) {
            console.error('Book export failed:', error);
            showMessage('error', t('bookExportError'));
        } finally {
            setGeneratingBook(false);
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
            if (response.ok) {
                const data = await response.json();
                setMessage({
                    type: 'success',
                    text: t('importSuccess', {
                        imported: data.importedCount,
                        skipped: data.skippedCount,
                    }),
                });
                setPreview(null);
                setFileContent('');
            }
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

    async function handleCloudUpload(provider: CloudProviderType): Promise<void> {
        setUploading(provider);
        const result = await cloudSyncService.uploadExport(provider, {
            diaryId: diaryId ?? undefined,
            format: cloudExportFormat,
            includeVisibility: cloudIncludeVisibility,
        });
        showMessage(result ? 'success' : 'error', result ? t('cloudUploadSuccess', { name: result.name }) : t('cloudUploadError'));
        setUploading(null);
    }

    async function handleSaveSchedule(provider: CloudProviderType): Promise<void> {
        const success = await cloudSyncService.setSchedule(provider, {
            frequency: scheduleFrequency[provider] || 'daily',
            format: scheduleFormat[provider],
            diaryId: diaryId ?? undefined,
            includeVisibility: scheduleIncludeVisibility[provider],
        });
        if (success) {
            showMessage('success', t('cloudScheduleSaved'));
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudScheduleSaveError'));
        }
    }

    async function handleRemoveSchedule(provider: CloudProviderType): Promise<void> {
        const success = await cloudSyncService.deleteSchedule(provider);
        if (success) {
            showMessage('success', t('cloudScheduleRemoved'));
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudScheduleRemoveError'));
        }
    }

    async function handleSyncNow(provider: CloudProviderType): Promise<void> {
        setSyncing(provider);
        const result = await cloudSyncService.triggerSync(provider);
        if (result) {
            showMessage('success', result.synced ? t('cloudSyncSuccess', { name: result.file?.name || '' }) : t('cloudSyncNoChanges'));
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudSyncError'));
        }
        setSyncing(null);
    }

    async function handleBrowseCloudFiles(provider: CloudProviderType): Promise<void> {
        if (cloudImportProvider === provider) {
            setCloudImportProvider(null);
            setCloudFiles([]);
            return;
        }
        setCloudImportProvider(provider);
        setLoadingCloudFiles(true);
        setCloudFiles(await cloudSyncService.listFiles(provider));
        setLoadingCloudFiles(false);
    }

    async function handleCloudFileImport(provider: CloudProviderType, file: CloudFileInfo): Promise<void> {
        setImportingCloudFile(file.id);
        const content = await cloudSyncService.downloadFile(provider, file.id);
        if (content) {
            await previewImportContent(content, t('cloudDownloadSuccess', { name: file.name }));
        } else {
            showMessage('error', t('cloudDownloadError'));
        }
        setImportingCloudFile(null);
    }

    const connectedProviders = CLOUD_PROVIDERS.filter((provider) => cloudStatus[provider]?.connected);

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
                showMessage('error', t('deleteAllError'));
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

            {message && <div className={`message ${message.type}`}>{message.text}</div>}

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
                    cloudImportContent={(
                        <CloudImportSection
                            cloudLoading={cloudLoading}
                            connectedProviders={connectedProviders}
                            cloudImportProvider={cloudImportProvider}
                            cloudFiles={cloudFiles}
                            loadingCloudFiles={loadingCloudFiles}
                            importingCloudFile={importingCloudFile}
                            onBrowseCloudFiles={handleBrowseCloudFiles}
                            onImportCloudFile={handleCloudFileImport}
                            t={t}
                        />
                    )}
                    t={t}
                />
            </div>

            <BookSection
                activeSection={activeSection}
                sectionRef={bookSectionRef}
                diaryName={diaryName}
                options={bookOptions}
                preview={bookPreview}
                generating={generatingBook}
                onOptionChange={handleBookOptionChange}
                onPreview={handleBookPreview}
                onDownload={handleBookDownload}
                t={t}
            />

            <CloudSyncSection
                connectedProviders={connectedProviders}
                schedules={schedules}
                uploading={uploading}
                syncing={syncing}
                scheduleFrequency={scheduleFrequency}
                setScheduleFrequency={setScheduleFrequency}
                scheduleFormat={scheduleFormat}
                setScheduleFormat={setScheduleFormat}
                scheduleIncludeVisibility={scheduleIncludeVisibility}
                setScheduleIncludeVisibility={setScheduleIncludeVisibility}
                cloudExportFormat={cloudExportFormat}
                setCloudExportFormat={setCloudExportFormat}
                cloudIncludeVisibility={cloudIncludeVisibility}
                setCloudIncludeVisibility={setCloudIncludeVisibility}
                onUpload={handleCloudUpload}
                onSaveSchedule={handleSaveSchedule}
                onRemoveSchedule={handleRemoveSchedule}
                onSyncNow={handleSyncNow}
                t={t}
            />

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
