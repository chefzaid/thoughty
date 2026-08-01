import type { RefObject } from 'react';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import type { ImportExportSection, TranslationFunction } from '../../types';
import { BookSection } from './ImportExportBookSection';
import type { MessageState } from './ImportExport.types';
import { useImportExportBook } from './useImportExportBook';

export function ImportExportBookPanel({
    activeSection,
    authFetch,
    connectedProviders,
    diaryId,
    diaryName,
    sectionRef,
    showMessage,
    t,
}: Readonly<{
    activeSection: ImportExportSection;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
    connectedProviders: CloudProviderType[];
    diaryId?: number | null;
    diaryName?: string;
    sectionRef: RefObject<HTMLElement | null>;
    showMessage: (type: MessageState['type'], text: string, duration?: number) => void;
    t: TranslationFunction;
}>) {
    const book = useImportExportBook({
        authFetch,
        connectedProviders,
        diaryId,
        showMessage,
        t,
    });

    return (
        <BookSection
            activeSection={activeSection}
            sectionRef={sectionRef}
            diaryName={diaryName}
            options={book.options}
            preview={book.preview}
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
            onDownload={book.handleDownload}
            onUpload={book.handleUpload}
            onCreateVersion={book.handleCreateVersion}
            onVersionDownload={book.handleVersionDownload}
            t={t}
        />
    );
}
