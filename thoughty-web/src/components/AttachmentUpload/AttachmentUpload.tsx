import { useRef, type ChangeEvent } from 'react';
import type { Attachment } from '../../types';

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function isImageType(mimetype: string): boolean {
    return mimetype.startsWith('image/');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentUploadProps {
    readonly pendingFiles: File[];
    readonly uploadedAttachments: Attachment[];
    readonly onAddFile: (file: File) => void;
    readonly onRemovePendingFile: (index: number) => void;
    readonly onRemoveUploadedAttachment: (id: number) => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string) => string;
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
    const isDark = theme !== 'light';

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            if (!ALLOWED_TYPES.includes(file.type)) {
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
        <div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${isDark
                        ? 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                        : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:text-gray-600'
                    }`}
                    title={t('attachFiles')}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm font-medium">{t('attach')}</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ALLOWED_TYPES.join(',')}
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {hasAttachments && (
                <div className="mt-3 flex flex-wrap gap-3">
                    {/* Pending files (not yet uploaded) */}
                    {pendingFiles.map((file, index) => (
                        <div
                            key={`pending-${index}`}
                            className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700/50 border-gray-600'
                                : 'bg-gray-100 border-gray-300'
                            }`}
                        >
                            {isImageType(file.type) ? (
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-10 h-10 object-cover rounded"
                                />
                            ) : (
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            )}
                            <div className="min-w-0">
                                <p className={`text-xs truncate max-w-[120px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {file.name}
                                </p>
                                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRemovePendingFile(index)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t('removeAttachment')}
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {/* Already uploaded attachments */}
                    {uploadedAttachments.map((att) => (
                        <div
                            key={`uploaded-${att.id}`}
                            className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700/50 border-green-600/30'
                                : 'bg-green-50 border-green-300'
                            }`}
                        >
                            {isImageType(att.mimetype) ? (
                                <img
                                    src={`/api/attachments/file/${att.stored_filename}`}
                                    alt={att.original_filename}
                                    className="w-10 h-10 object-cover rounded"
                                />
                            ) : (
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            )}
                            <div className="min-w-0">
                                <p className={`text-xs truncate max-w-[120px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {att.original_filename}
                                </p>
                                <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRemoveUploadedAttachment(att.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title={t('removeAttachment')}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AttachmentUpload;
