import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Attachment } from '../../types';
import {
    ALLOWED_ATTACHMENT_TYPES,
    formatAttachmentSize,
    getAttachmentKindLabel,
    getAttachmentUrl,
    hasInlineAttachmentPreview,
} from '../../utils/attachments';
import AttachmentPreviewContent from '../AttachmentPreview/AttachmentPreviewContent';
import AttachmentPreviewDialog from '../AttachmentPreview/AttachmentPreviewDialog';
import { usePendingAttachmentPreviewUrl } from '../AttachmentPreview/usePendingAttachmentPreviewUrl';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface AttachmentUploadProps {
    readonly pendingFiles: File[];
    readonly uploadedAttachments: Attachment[];
    readonly onAddFile: (file: File) => void;
    readonly onRemovePendingFile: (index: number) => void;
    readonly onRemoveUploadedAttachment: (id: number) => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string) => string;
}

interface ActiveUploadPreview {
    readonly name: string;
    readonly mimetype: string;
    readonly sourceUrl: string;
    readonly size: number;
    readonly downloadUrl?: string;
}

function StoredAttachmentPreview({ attachment }: Readonly<{ attachment: Attachment }>) {
    return (
        <AttachmentPreviewContent
            name={attachment.original_filename}
            mimetype={attachment.mimetype}
            sourceUrl={getAttachmentUrl(attachment.stored_filename)}
        />
    );
}

function AttachmentCard({
    name,
    size,
    kind,
    preview,
    isDark,
    onRemove,
    accentClass,
    action,
    t,
}: Readonly<{
    name: string;
    size: number;
    kind: string;
    preview: ReactNode;
    isDark: boolean;
    onRemove: () => void;
    accentClass: string;
    action?: ReactNode;
    t: (key: string) => string;
}>) {
    return (
        <div
            className={`relative group flex w-full max-w-[240px] flex-col gap-3 rounded-lg border p-3 ${accentClass}`}
        >
            <div className={`flex min-h-[72px] items-center justify-center overflow-hidden rounded-md border px-2 py-2 ${isDark ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
                {preview}
            </div>
            <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {name}
                </p>
                <p className="text-xs text-gray-500">{kind} · {formatAttachmentSize(size)}</p>
            </div>
            {action && <div>{action}</div>}
            <button
                type="button"
                onClick={onRemove}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                title={t('removeAttachment')}
            >
                ×
            </button>
        </div>
    );
}

function PendingAttachmentCard({
    file,
    index,
    isDark,
    onRemove,
    onPreview,
    t,
}: Readonly<{
    file: File;
    index: number;
    isDark: boolean;
    onRemove: (index: number) => void;
    onPreview: (preview: ActiveUploadPreview) => void;
    t: (key: string) => string;
}>) {
    const previewUrl = usePendingAttachmentPreviewUrl(file);
    const canPreview = Boolean(previewUrl) && hasInlineAttachmentPreview(file.type);

    return (
        <AttachmentCard
            key={`${file.name}-${file.lastModified}-${file.size}`}
            name={file.name}
            size={file.size}
            kind={getAttachmentKindLabel(file.type)}
            preview={(
                <AttachmentPreviewContent
                    name={file.name}
                    mimetype={file.type}
                    sourceUrl={previewUrl}
                />
            )}
            isDark={isDark}
            accentClass={isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'}
            action={canPreview ? (
                <button
                    type="button"
                    onClick={() => onPreview({
                        name: file.name,
                        mimetype: file.type,
                        sourceUrl: previewUrl!,
                        size: file.size,
                    })}
                    className={`text-xs font-medium ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
                    aria-label={`${t('previewAttachment')} ${file.name}`}
                >
                    {t('previewAttachment')}
                </button>
            ) : undefined}
            onRemove={() => onRemove(index)}
            t={t}
        />
    );
}

function UploadedAttachmentCard({
    attachment,
    isDark,
    onRemove,
    onPreview,
    t,
}: Readonly<{
    attachment: Attachment;
    isDark: boolean;
    onRemove: (id: number) => void;
    onPreview: (preview: ActiveUploadPreview) => void;
    t: (key: string) => string;
}>) {
    const fileUrl = getAttachmentUrl(attachment.stored_filename);
    const canPreview = hasInlineAttachmentPreview(attachment.mimetype);

    return (
        <AttachmentCard
            key={`uploaded-${attachment.id}`}
            name={attachment.original_filename}
            size={attachment.size}
            kind={getAttachmentKindLabel(attachment.mimetype)}
            preview={<StoredAttachmentPreview attachment={attachment} />}
            isDark={isDark}
            accentClass={isDark ? 'bg-gray-700/50 border-green-600/30' : 'bg-green-50 border-green-300'}
            action={(
                <div className="flex items-center gap-3">
                    {canPreview && (
                        <button
                            type="button"
                            onClick={() => onPreview({
                                name: attachment.original_filename,
                                mimetype: attachment.mimetype,
                                sourceUrl: fileUrl,
                                size: attachment.size,
                                downloadUrl: fileUrl,
                            })}
                            className={`text-xs font-medium ${isDark ? 'text-green-300 hover:text-green-200' : 'text-green-700 hover:text-green-800'}`}
                            aria-label={`${t('previewAttachment')} ${attachment.original_filename}`}
                        >
                            {t('previewAttachment')}
                        </button>
                    )}
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs font-medium ${isDark ? 'text-green-300 hover:text-green-200' : 'text-green-700 hover:text-green-800'}`}
                    >
                        {t('downloadAttachment')}
                    </a>
                </div>
            )}
            onRemove={() => onRemove(attachment.id)}
            t={t}
        />
    );
}

function AttachmentUpload({
    pendingFiles,
    uploadedAttachments,
    onAddFile,
    onRemovePendingFile,
    onRemoveUploadedAttachment,
    theme,
    t
}: AttachmentUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activePreview, setActivePreview] = useState<ActiveUploadPreview | null>(null);
    const isDark = theme !== 'light';

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number])) {
                alert(t('attachmentTypeNotAllowed'));
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                alert(t('attachmentTooLarge'));
                continue;
            }
            onAddFile(file);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const hasAttachments = pendingFiles.length > 0 || uploadedAttachments.length > 0;

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all h-full ${isDark
                    ? 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                    : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:text-gray-600'
                }`}
                title={t('attachFiles')}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
            />

            {hasAttachments && (
                <div className="mt-3 flex flex-wrap gap-3">
                    {pendingFiles.map((file, index) => (
                        <PendingAttachmentCard
                            key={`${file.name}-${file.lastModified}-${file.size}`}
                            file={file}
                            index={index}
                            isDark={isDark}
                            onRemove={onRemovePendingFile}
                            onPreview={setActivePreview}
                            t={t}
                        />
                    ))}

                    {uploadedAttachments.map((att) => (
                        <UploadedAttachmentCard
                            key={`uploaded-${att.id}`}
                            attachment={att}
                            isDark={isDark}
                            onRemove={onRemoveUploadedAttachment}
                            onPreview={setActivePreview}
                            t={t}
                        />
                    ))}
                </div>
            )}

            <AttachmentPreviewDialog
                preview={activePreview}
                isDark={isDark}
                onClose={() => setActivePreview(null)}
                t={t}
            />
        </div>
    );
}

export default AttachmentUpload;
