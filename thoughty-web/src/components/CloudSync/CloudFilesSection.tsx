import type { CloudFileInfo } from '../../services/api/cloudSyncService';
import { formatDate, formatFileSize } from './cloudSyncFormat';

interface CloudFilesSectionProps {
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly providerName: string;
    readonly files: CloudFileInfo[];
    readonly loading: boolean;
    readonly downloadingFileId: string | null;
    readonly onDownload: (file: CloudFileInfo) => void;
}

/** The export files stored in one provider, each with a download button. */
function CloudFilesSection({ t, providerName, files, loading, downloadingFileId, onDownload }: CloudFilesSectionProps) {
    return (
        <div className="cloud-files-section">
            <h4>{t('cloudFilesInCloud', { provider: providerName })}</h4>
            {loading && (
                <div className="cloud-no-files">{t('loading')}...</div>
            )}
            {!loading && files.length === 0 && (
                <div className="cloud-no-files">{t('cloudNoFiles')}</div>
            )}
            {!loading && files.length > 0 && (
                <div className="cloud-files-list">
                    {files.map(file => (
                        <div key={file.id} className="cloud-file-item">
                            <div className="cloud-file-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="cloud-file-info">
                                <div className="cloud-file-name">{file.name}</div>
                                <div className="cloud-file-meta">
                                    {formatFileSize(file.size)} · {formatDate(file.modifiedAt)}
                                </div>
                            </div>
                            <div className="cloud-file-actions">
                                <button type="button"
                                    className="cloud-btn browse"
                                    onClick={() => onDownload(file)}
                                    disabled={downloadingFileId === file.id}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {downloadingFileId === file.id ? t('downloading') : t('cloudDownload')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CloudFilesSection;
