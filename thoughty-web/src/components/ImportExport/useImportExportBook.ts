import { useEffect, useRef, useState } from 'react';
import type { TranslationFunction } from '../../types';
import type { CloudFileInfo, CloudProviderType } from '../../services/api/cloudSyncService';
import { downloadBlob } from '../../utils/downloadFile';
import { readApiErrorMessage } from '../../services/api/base';
import { appendBookSourceParams, bookVersionsQuery, isBookSourceReady } from './bookSource';
import { useBookSourceData } from './useBookSourceData';
import { isCachedPdfFor, pdfSettings, readBookFile, type CachedBookPdf, type GeneratedBookFile } from './bookFile';
import {
    DEFAULT_BOOK_OPTIONS,
    type BookOptions,
    type BookPreviewData,
    type BookVersionData,
    type MessageState,
} from './ImportExport.types';

const SOURCE_OPTION_KEYS: ReadonlySet<keyof BookOptions> = new Set(['source', 'savedSearchId', 'entryIds']);

/** The page-by-page preview: open, with the generated PDF once it is ready. */
export interface BookPagePreviewState {
    readonly file: GeneratedBookFile | null;
}

interface UseImportExportBookProps {
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    connectedProviders: CloudProviderType[];
    diaryId?: number | null;
    /** Entries picked in the journal (its Make a book action), which open the converter as a hand-picked book. */
    initialEntryIds?: readonly number[];
    showMessage: (type: MessageState['type'], text: string, duration?: number) => void;
    t: TranslationFunction;
}

export function useImportExportBook({
    authFetch,
    connectedProviders,
    diaryId,
    initialEntryIds,
    showMessage,
    t,
}: UseImportExportBookProps) {
    const [options, setOptions] = useState<BookOptions>(() => (initialEntryIds?.length
        ? { ...DEFAULT_BOOK_OPTIONS, source: 'entries', entryIds: [...new Set(initialEntryIds)] }
        : DEFAULT_BOOK_OPTIONS));
    const sourceData = useBookSourceData({ authFetch, options });
    const sourceReady = isBookSourceReady(options);
    const versionsQuery = bookVersionsQuery(options, diaryId);
    const [preview, setPreview] = useState<BookPreviewData | null>(null);
    const [action, setAction] = useState<'download' | 'upload' | 'version' | null>(null);
    const [versions, setVersions] = useState<BookVersionData[]>([]);
    const [downloadingVersionId, setDownloadingVersionId] = useState<number | null>(null);
    const versionRequestRef = useRef(0);
    const [pagePreview, setPagePreview] = useState<BookPagePreviewState | null>(null);
    /** The last PDF generated, so previewing then downloading with the same settings generates it once. */
    const lastPdfRef = useRef<CachedBookPdf | null>(null);
    const pagePreviewAbortRef = useRef<AbortController | null>(null);
    const [cloudProvider, setCloudProvider] = useState<CloudProviderType | ''>('');
    const selectedCloudProvider: CloudProviderType | '' = cloudProvider && connectedProviders.includes(cloudProvider)
        ? cloudProvider
        : connectedProviders[0] ?? '';

    useEffect(() => {
        let active = true;
        const requestId = ++versionRequestRef.current;
        setVersions([]);
        if (versionsQuery === null) {
            return undefined;
        }

        authFetch(`/api/books/versions?${versionsQuery}`)
            .then(async (response) => {
                if (!response.ok) {
                    return;
                }
                const loadedVersions = await response.json() as BookVersionData[];
                if (active && requestId === versionRequestRef.current) {
                    setVersions(loadedVersions);
                }
            })
            .catch((error: unknown) => console.error('Book version history failed:', error));

        return () => {
            active = false;
        };
    }, [authFetch, versionsQuery]);

    useEffect(() => () => pagePreviewAbortRef.current?.abort(), []);

    function buildParams(): URLSearchParams {
        const params = new URLSearchParams();
        appendBookSourceParams(params, options, diaryId);
        if (options.title.trim()) params.append('title', options.title.trim());
        if (options.author.trim()) params.append('author', options.author.trim());
        if (options.format !== 'pdf') params.append('format', options.format);
        if (options.chapterMode !== 'tags') params.append('chapterMode', options.chapterMode);
        if (options.chapterOrder !== 'alpha') params.append('chapterOrder', options.chapterOrder);
        if (options.tagScope !== 'all') params.append('tagScope', options.tagScope);
        if (options.weavingMode !== 'strict') params.append('weavingMode', options.weavingMode);
        if (!options.includeUntagged) params.append('includeUntagged', 'false');
        if (!options.includeDates) params.append('includeDates', 'false');
        if (!options.includeToc) params.append('includeToc', 'false');
        if (!options.narrative) params.append('narrative', 'false');
        if (options.chapterFraming) params.append('chapterFraming', 'true');
        if (options.embedImages) params.append('embedImages', 'true');
        if (options.coverTheme !== 'classic') params.append('coverTheme', options.coverTheme);
        return params;
    }

    function buildCoverBody(): FormData | undefined {
        if (!options.coverImage) {
            return undefined;
        }
        const body = new FormData();
        body.append('coverImage', options.coverImage);
        return body;
    }

    function changeOption<K extends keyof BookOptions>(key: K, value: BookOptions[K]): void {
        setOptions((current) => ({ ...current, [key]: value }));
        // An outline of other entries would mislead
        if (SOURCE_OPTION_KEYS.has(key)) setPreview(null);
    }

    /** Builds the next version of a hand-picked book from the entries a saved version holds. */
    function pickVersionEntries(version: BookVersionData): void {
        setOptions((current) => ({ ...current, source: 'entries', entryIds: [...(version.source.entryIds ?? [])] }));
        setPreview(null);
    }

    async function failureMessage(response: Response, fallback: string): Promise<string> {
        return t(await readApiErrorMessage(response, fallback));
    }

    /** Generates the book; a refusal is shown and answers null. */
    async function requestBookFile(params: URLSearchParams, extension: string, signal?: AbortSignal): Promise<GeneratedBookFile | null> {
        const coverBody = buildCoverBody();
        const response = await authFetch(`/api/books/export?${params}`, coverBody
            ? { method: 'POST', body: coverBody, signal }
            : { method: 'GET', signal });
        if (!response.ok) {
            showMessage('error', await failureMessage(response, 'bookExportError'));
            return null;
        }
        return readBookFile(response, extension);
    }

    function saveBookFile(file: GeneratedBookFile): void {
        downloadBlob(file.blob, file.filename);
        showMessage('success', t('bookExportSuccess'), 3000);
    }

    /** Opens the page-by-page preview of the PDF these settings generate, reusing the last one if they are unchanged. */
    async function handlePagePreview(): Promise<void> {
        const params = buildParams();
        const settings = pdfSettings(params);
        if (isCachedPdfFor(lastPdfRef.current, settings, options)) {
            setPagePreview({ file: lastPdfRef.current.file });
            return;
        }

        pagePreviewAbortRef.current?.abort();
        const controller = new AbortController();
        pagePreviewAbortRef.current = controller;
        const coverImage = options.coverImage;
        setPagePreview({ file: null });
        try {
            params.delete('format');
            const file = await requestBookFile(params, 'pdf', controller.signal);
            if (controller.signal.aborted) return;
            if (file) lastPdfRef.current = { settings, coverImage, file };
            setPagePreview(file ? { file } : null);
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error('Book page preview failed:', error);
            setPagePreview(null);
            showMessage('error', t('bookExportError'));
        }
    }

    function closePagePreview(): void {
        pagePreviewAbortRef.current?.abort();
        pagePreviewAbortRef.current = null;
        setPagePreview(null);
    }

    function downloadPagePreview(): void {
        if (pagePreview?.file) saveBookFile(pagePreview.file);
    }

    async function handlePreview(): Promise<void> {
        try {
            const response = await authFetch(`/api/books/preview?${buildParams()}`);
            if (!response.ok) {
                showMessage('error', await failureMessage(response, 'bookPreviewError'));
                return;
            }
            setPreview(await response.json());
        } catch (error) {
            console.error('Book preview failed:', error);
            showMessage('error', t('bookPreviewError'));
        }
    }

    async function handleDownload(): Promise<void> {
        const params = buildParams();
        const settings = pdfSettings(params);
        if (options.format === 'pdf' && isCachedPdfFor(lastPdfRef.current, settings, options)) {
            saveBookFile(lastPdfRef.current.file);
            return;
        }

        setAction('download');
        try {
            const coverImage = options.coverImage;
            const file = await requestBookFile(params, options.format);
            if (!file) return;
            if (options.format === 'pdf') lastPdfRef.current = { settings, coverImage, file };
            saveBookFile(file);
        } catch (error) {
            console.error('Book export failed:', error);
            showMessage('error', t('bookExportError'));
        } finally {
            setAction(null);
        }
    }

    async function handleUpload(): Promise<void> {
        if (!selectedCloudProvider) return;

        setAction('upload');
        try {
            const params = buildParams();
            params.set('provider', selectedCloudProvider);
            const response = await authFetch(`/api/books/upload?${params}`, {
                method: 'POST',
                body: buildCoverBody(),
            });
            if (!response.ok) {
                showMessage('error', await failureMessage(response, 'bookCloudUploadError'));
                return;
            }

            const file = await response.json() as CloudFileInfo;
            showMessage('success', t('bookCloudUploadSuccess', { name: file.name }), 3000);
        } catch (error) {
            console.error('Book cloud upload failed:', error);
            showMessage('error', t('bookCloudUploadError'));
        } finally {
            setAction(null);
        }
    }

    async function handleCreateVersion(): Promise<void> {
        setAction('version');
        try {
            const response = await authFetch(`/api/books/versions?${buildParams()}`, {
                method: 'POST',
                body: buildCoverBody(),
            });
            if (!response.ok) {
                showMessage('error', await failureMessage(response, 'bookVersionSaveError'));
                return;
            }
            const version = await response.json() as BookVersionData;
            versionRequestRef.current += 1;
            setVersions((current) => [version, ...current]);
            showMessage('success', t('bookVersionSaved', { version: version.versionNumber }), 3000);
        } catch (error) {
            console.error('Book version save failed:', error);
            showMessage('error', t('bookVersionSaveError'));
        } finally {
            setAction(null);
        }
    }

    async function handleVersionDownload(version: BookVersionData): Promise<void> {
        setDownloadingVersionId(version.id);
        try {
            const response = await authFetch(`/api/books/versions/${version.id}/download`);
            if (!response.ok) {
                showMessage('error', t('bookVersionDownloadError'));
                return;
            }
            downloadBlob(await response.blob(), version.filename);
        } catch (error) {
            console.error('Book version download failed:', error);
            showMessage('error', t('bookVersionDownloadError'));
        } finally {
            setDownloadingVersionId(null);
        }
    }

    return {
        action,
        changeOption,
        closePagePreview,
        cloudProvider: selectedCloudProvider,
        downloadPagePreview,
        downloadingVersionId,
        handleCreateVersion,
        handleDownload,
        handlePagePreview,
        handlePreview,
        handleUpload,
        handleVersionDownload,
        options,
        pagePreview,
        pickedEntries: sourceData.pickedEntries,
        preview,
        savedSearches: sourceData.savedSearches,
        setCloudProvider,
        sourceReady,
        pickVersionEntries,
        versions,
    };
}
