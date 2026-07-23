import { useState } from 'react';
import type { TranslationFunction } from '../../types';
import type { CloudFileInfo, CloudProviderType } from '../../services/api/cloudSyncService';
import { downloadBlob } from '../../utils/downloadFile';
import {
    DEFAULT_BOOK_OPTIONS,
    type BookOptions,
    type BookPreviewData,
    type MessageState,
} from './ImportExport.types';

interface UseImportExportBookProps {
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    connectedProviders: CloudProviderType[];
    diaryId?: number | null;
    showMessage: (type: MessageState['type'], text: string, duration?: number) => void;
    t: TranslationFunction;
}

export function useImportExportBook({
    authFetch,
    connectedProviders,
    diaryId,
    showMessage,
    t,
}: UseImportExportBookProps) {
    const [options, setOptions] = useState<BookOptions>(DEFAULT_BOOK_OPTIONS);
    const [preview, setPreview] = useState<BookPreviewData | null>(null);
    const [action, setAction] = useState<'download' | 'upload' | null>(null);
    const [cloudProvider, setCloudProvider] = useState<CloudProviderType | ''>('');
    const selectedCloudProvider: CloudProviderType | '' = cloudProvider && connectedProviders.includes(cloudProvider)
        ? cloudProvider
        : connectedProviders[0] ?? '';

    function buildParams(): URLSearchParams {
        const params = new URLSearchParams();
        if (diaryId) params.append('diaryId', diaryId.toString());
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
    }

    async function handlePreview(): Promise<void> {
        try {
            const response = await authFetch(`/api/books/preview?${buildParams()}`);
            if (!response.ok) {
                showMessage('error', t('bookPreviewError'));
                return;
            }
            setPreview(await response.json());
        } catch (error) {
            console.error('Book preview failed:', error);
            showMessage('error', t('bookPreviewError'));
        }
    }

    async function handleDownload(): Promise<void> {
        setAction('download');
        try {
            const coverBody = buildCoverBody();
            const response = await authFetch(`/api/books/export?${buildParams()}`, coverBody
                ? { method: 'POST', body: coverBody }
                : undefined);
            if (!response.ok) {
                showMessage('error', t('bookExportError'));
                return;
            }

            const blob = await response.blob();
            const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
                || `thoughty_book_${new Date().toISOString().split('T')[0]}.${options.format}`;
            downloadBlob(blob, filename);
            showMessage('success', t('bookExportSuccess'), 3000);
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
                showMessage('error', t('bookCloudUploadError'));
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

    return {
        action,
        changeOption,
        cloudProvider: selectedCloudProvider,
        handleDownload,
        handlePreview,
        handleUpload,
        options,
        preview,
        setCloudProvider,
    };
}
