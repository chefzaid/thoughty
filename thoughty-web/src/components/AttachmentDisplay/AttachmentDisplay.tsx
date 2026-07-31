import { useState, type ReactNode } from 'react';
import type { Attachment } from '../../types';
import {
    formatAttachmentSize,
    getAttachmentKindLabel,
    hasInlineAttachmentPreview,
    isImageAttachment,
} from '../../utils/attachments';
import AttachmentPreviewContent from '../AttachmentPreview/AttachmentPreviewContent';
import AttachmentPreviewDialog from '../AttachmentPreview/AttachmentPreviewDialog';
import { useAuthenticatedAttachmentUrl } from '../AttachmentPreview/useAuthenticatedAttachmentUrl';

interface AttachmentDisplayProps {
    readonly attachments: Attachment[];
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string) => string;
}

interface ActivePreviewAttachment {
    readonly name: string;
    readonly mimetype: string;
    readonly url: string;
    readonly size: number;
}

function StoredAttachmentResource({
    attachment,
    children,
}: Readonly<{
    attachment: Attachment;
    children: (url: string | null) => ReactNode;
}>) {
    const url = useAuthenticatedAttachmentUrl(attachment.stored_filename);
    return children(url);
}

function AttachmentDisplay({ attachments, theme, t }: AttachmentDisplayProps) {
    const [activePreview, setActivePreview] = useState<ActivePreviewAttachment | null>(null);
    const isDark = theme !== 'light';

    if (!attachments || attachments.length === 0) return null;

    const images = attachments.filter(a => isImageAttachment(a.mimetype));
    const previewFiles = attachments.filter(a => !isImageAttachment(a.mimetype) && hasInlineAttachmentPreview(a.mimetype));
    const files = attachments.filter(a => !hasInlineAttachmentPreview(a.mimetype));

    const openPreview = (attachment: Attachment, url: string) => {
        setActivePreview({
            name: attachment.original_filename,
            mimetype: attachment.mimetype,
            url,
            size: attachment.size,
        });
    };

    const closePreview = () => {
        setActivePreview(null);
    };

    return (
        <div className="mt-3">
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {images.map((img) => (
                        <StoredAttachmentResource key={img.id} attachment={img}>
                            {(url) => (
                                <button
                                    type="button"
                                    disabled={!url}
                                    onClick={() => url && openPreview(img, url)}
                                    className="relative group cursor-pointer disabled:cursor-wait"
                                >
                                    <AttachmentPreviewContent
                                        name={img.original_filename}
                                        mimetype={img.mimetype}
                                        sourceUrl={url}
                                        variant="detail"
                                    />
                                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        {img.original_filename}
                                    </div>
                                </button>
                            )}
                        </StoredAttachmentResource>
                    ))}
                </div>
            )}

            {previewFiles.length > 0 && (
                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                    {previewFiles.map((file) => (
                        <StoredAttachmentResource key={file.id} attachment={file}>
                          {(url) => (
                            <div
                            className={`rounded-lg border p-3 ${isDark
                                ? 'bg-gray-700/50 border-gray-600 text-gray-200'
                                : 'bg-gray-50 border-gray-300 text-gray-800'
                            }`}
                        >
                            <p className="mb-2 truncate text-sm font-medium">{file.original_filename}</p>
                            <div className={`flex min-h-[72px] items-center justify-center overflow-hidden rounded-md border px-2 py-2 ${isDark ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
                                <AttachmentPreviewContent
                                    name={file.original_filename}
                                    mimetype={file.mimetype}
                                    sourceUrl={url}
                                    variant="detail"
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                                <span>{getAttachmentKindLabel(file.mimetype)} · {formatAttachmentSize(file.size)}</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={!url}
                                        onClick={() => url && openPreview(file, url)}
                                        className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                        aria-label={`${t('previewAttachment')} ${file.original_filename}`}
                                    >
                                        {t('previewAttachment')}
                                    </button>
                                    <a
                                        href={url ?? undefined}
                                        download={file.original_filename}
                                        aria-disabled={!url}
                                        className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                                    >
                                        {t('downloadAttachment')}
                                    </a>
                                </div>
                            </div>
                            </div>
                          )}
                        </StoredAttachmentResource>
                    ))}
                </div>
            )}

            {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {files.map((file) => (
                        <StoredAttachmentResource key={file.id} attachment={file}>
                          {(url) => (
                            <a
                            href={url ?? undefined}
                            download={file.original_filename}
                            aria-disabled={!url}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isDark
                                ? 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                                : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                            }`}
                        >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate max-w-[150px]">{file.original_filename}</span>
                            <span className="text-xs text-gray-500">({formatAttachmentSize(file.size)})</span>
                            </a>
                          )}
                        </StoredAttachmentResource>
                    ))}
                </div>
            )}

            <AttachmentPreviewDialog
                preview={activePreview ? {
                    name: activePreview.name,
                    mimetype: activePreview.mimetype,
                    sourceUrl: activePreview.url,
                    size: activePreview.size,
                    downloadUrl: activePreview.url,
                } : null}
                isDark={isDark}
                onClose={closePreview}
                t={t}
            />
        </div>
    );
}

export default AttachmentDisplay;
