import { useState } from 'react';
import type { Attachment } from '../../types';
import AttachmentPreviewContent from './AttachmentPreviewContent';
import { useAuthenticatedAttachmentResource, useAuthenticatedAttachmentUrl } from './useAuthenticatedAttachmentUrl';

type Translate = (key: string, params?: Record<string, string | number>) => string;

function VideoIcon() {
    return (
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
}

function PlayBadge() {
    return (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg">
                <svg className="ml-1 h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
        </span>
    );
}

/**
 * A stored video: its poster frame (or a video icon when it has none) as a play button, and once
 * pressed the video itself, loaded with the session and played in place with the browser's own
 * controls. Nothing but the small poster is fetched until the reader asks to play it.
 */
function StoredVideoPlayer({ attachment, variant = 'detail', isDark, showDownload = true, t }: Readonly<{
    attachment: Attachment;
    variant?: 'compact' | 'detail';
    isDark: boolean;
    showDownload?: boolean;
    t: Translate;
}>) {
    const [requested, setRequested] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const posterUrl = useAuthenticatedAttachmentUrl(attachment.poster_filename ?? null);
    const video = useAuthenticatedAttachmentResource(requested ? attachment.stored_filename : null, attempt);
    const name = attachment.original_filename;
    const linkClass = isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800';

    if (video.url) {
        return (
            <div className="flex w-full flex-col gap-2">
                <AttachmentPreviewContent name={name} mimetype={attachment.mimetype} sourceUrl={video.url} posterUrl={posterUrl} variant={variant} autoPlay t={t} />
                {showDownload && (
                    <a href={video.url} download={name} className={`self-end text-xs ${linkClass}`}>
                        {t('downloadAttachment')}
                    </a>
                )}
            </div>
        );
    }

    const frameClass = variant === 'compact' ? 'h-28' : 'h-48';
    return (
        <div className="flex w-full flex-col gap-2">
            <button
                type="button"
                onClick={() => setRequested(true)}
                disabled={video.status === 'loading'}
                aria-label={t('videoPlay', { name })}
                className={`relative flex w-full items-center justify-center overflow-hidden rounded-md bg-black/80 text-gray-300 disabled:cursor-wait ${frameClass}`}
            >
                {posterUrl
                    ? <img src={posterUrl} alt="" className="h-full w-full object-cover" />
                    : <VideoIcon />}
                <PlayBadge />
            </button>
            <p role="status" className="text-xs">
                {video.status === 'loading' && t('videoLoading', { name })}
                {video.status === 'failed' && t('videoLoadFailed', { name })}
            </p>
            {video.status === 'failed' && (
                <button type="button" onClick={() => setAttempt((count) => count + 1)} className={`self-start text-xs font-medium ${linkClass}`}>
                    {t('videoRetry')}
                </button>
            )}
        </div>
    );
}

export default StoredVideoPlayer;
