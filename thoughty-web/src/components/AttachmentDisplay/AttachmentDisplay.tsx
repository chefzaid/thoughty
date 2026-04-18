import { useState } from 'react';
import type { Attachment } from '../../types';

function isImageType(mimetype: string): boolean {
    return mimetype.startsWith('image/');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentDisplayProps {
    readonly attachments: Attachment[];
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string) => string;
}

function AttachmentDisplay({ attachments, theme, t }: AttachmentDisplayProps) {
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const isDark = theme !== 'light';

    if (!attachments || attachments.length === 0) return null;

    const images = attachments.filter(a => isImageType(a.mimetype));
    const files = attachments.filter(a => !isImageType(a.mimetype));

    return (
        <div className="mt-3">
            {/* Image grid */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {images.map((img) => (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => setLightboxImage(`/api/attachments/file/${img.stored_filename}`)}
                            className="relative group cursor-pointer"
                        >
                            <img
                                src={`/api/attachments/file/${img.stored_filename}`}
                                alt={img.original_filename}
                                className={`max-h-48 max-w-xs rounded-lg border object-cover transition-opacity group-hover:opacity-90 ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
                                loading="lazy"
                            />
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                {img.original_filename}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* File list */}
            {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {files.map((file) => (
                        <a
                            key={file.id}
                            href={`/api/attachments/file/${file.stored_filename}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isDark
                                ? 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                                : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-gray-400'
                            }`}
                        >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="truncate max-w-[150px]">{file.original_filename}</span>
                            <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                        </a>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxImage(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setLightboxImage(null); }}
                    role="dialog"
                    tabIndex={0}
                    aria-label={t('closeImage')}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
                        aria-label={t('close')}
                    >
                        ×
                    </button>
                    <img
                        src={lightboxImage}
                        alt=""
                        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

export default AttachmentDisplay;
