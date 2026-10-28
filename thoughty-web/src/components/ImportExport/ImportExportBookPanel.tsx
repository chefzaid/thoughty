import { useMemo, useState, type RefObject } from 'react';
import { createShareLinksService } from '../../services/api/shareLinksService';
import ShareLinkDialog from '../ShareLinks/ShareLinkDialog';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import type { ImportExportSection, TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { BookSection } from './ImportExportBookSection';
import type { MessageState } from './ImportExport.types';
import { useImportExportBook } from './useImportExportBook';
import { BookPreviewDialog } from '../BookPreview/BookPreviewDialog';
import { BOOK_FORMAT_OPTIONS, type BookVersionData } from './ImportExport.types';

export function ImportExportBookPanel({
    activeSection,
    authFetch,
    connectedProviders,
    diaryId,
    diaryName,
    initialEntryIds,
    isLight,
    language,
    sectionRef,
    showMessage,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    connectedProviders: CloudProviderType[];
    diaryId?: number | null;
    diaryName?: string;
    initialEntryIds?: readonly number[];
    isLight: boolean;
    language: Language;
    sectionRef: RefObject<HTMLElement | null>;
    showMessage: (type: MessageState['type'], text: string, duration?: number) => void;
    t: TranslationFunction;
}>) {
    const book = useImportExportBook({
        authFetch,
        connectedProviders,
        diaryId,
        initialEntryIds,
        showMessage,
        t,
    });

    const shareLinks = useMemo(() => createShareLinksService(authFetch), [authFetch]);
    const [sharedVersion, setSharedVersion] = useState<BookVersionData | null>(null);

    const formatLabelKey = BOOK_FORMAT_OPTIONS.find((option) => option.value === book.options.format)?.labelKey;
    const formatNotice = book.options.format !== 'pdf' && formatLabelKey
        ? t('bookPagePreviewFormatNotice', { format: t(formatLabelKey) })
        : undefined;

    return (
        <>
        <BookSection
            activeSection={activeSection}
            sectionRef={sectionRef}
            diaryName={diaryName}
            options={book.options}
            preview={book.preview}
            sourceReady={book.sourceReady}
            savedSearches={book.savedSearches}
            pickedEntries={book.pickedEntries}
            generating={book.action !== null}
            uploading={book.action === 'upload'}
            savingVersion={book.action === 'version'}
            versions={book.versions}
            downloadingVersionId={book.downloadingVersionId}
            connectedProviders={connectedProviders}
            cloudProvider={book.cloudProvider}
            onCloudProviderChange={book.setCloudProvider}
            onOptionChange={book.changeOption}
            onPreview={book.handlePreview}
            onPagePreview={book.handlePagePreview}
            onDownload={book.handleDownload}
            onUpload={book.handleUpload}
            onCreateVersion={book.handleCreateVersion}
            onVersionDownload={book.handleVersionDownload}
            onUseVersionEntries={book.pickVersionEntries}
            onVersionShare={setSharedVersion}
            language={language}
            t={t}
        />
        <BookPreviewDialog
            open={book.pagePreview !== null}
            file={book.pagePreview?.file?.blob ?? null}
            notice={formatNotice}
            isLight={isLight}
            onClose={book.closePagePreview}
            onDownload={book.downloadPagePreview}
            t={t}
        />
        {sharedVersion && (
            <ShareLinkDialog
                isOpen
                target={{ kind: 'bookVersion', id: sharedVersion.id }}
                subject={`${t('bookVersionNumber', { version: sharedVersion.versionNumber })} · ${sharedVersion.title}`}
                isDark={!isLight}
                language={language}
                service={shareLinks}
                onClose={() => setSharedVersion(null)}
                t={t}
            />
        )}
        </>
    );
}
