import { useState } from 'react';
import {
  EMPTY_CAPTIONS_TRACK_URL,
  isAudioAttachment,
  isVideoAttachment,
  isImageAttachment,
  isPdfAttachment,
  isTextAttachment,
  hasInlineAttachmentPreview,
} from '../../utils/attachments';

type AttachmentPreviewVariant = 'compact' | 'detail' | 'modal';

interface AttachmentPreviewContentProps {
  readonly name: string;
  readonly mimetype: string;
  readonly sourceUrl: string | null;
  readonly variant?: AttachmentPreviewVariant;
  /** A video's poster frame, shown until it plays. */
  readonly posterUrl?: string | null;
  /** Starts a video at once, for a player the reader just asked to play. */
  readonly autoPlay?: boolean;
  readonly t: (key: string) => string;
}

function AttachmentFileIcon() {
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function getIframeClassName(variant: AttachmentPreviewVariant): string {
  if (variant === 'modal') {
    return 'h-[70vh] w-full rounded-md border-0 bg-white';
  }

  return variant === 'detail'
    ? 'h-72 w-full rounded-md border-0 bg-white'
    : 'h-28 w-full rounded-md border-0 bg-white';
}

function getImageClassName(variant: AttachmentPreviewVariant): string {
  if (variant === 'modal') {
    return 'max-h-[75vh] w-full rounded-md object-contain';
  }

  return variant === 'detail'
    ? 'max-h-64 w-full rounded-md object-contain'
    : 'h-28 w-full rounded-md object-cover';
}

function getVideoClassName(variant: AttachmentPreviewVariant): string {
  if (variant === 'modal') {
    return 'max-h-[75vh] w-full rounded-md bg-black';
  }
  return variant === 'detail' ? 'max-h-72 w-full rounded-md bg-black' : 'h-28 w-full rounded-md bg-black object-cover';
}

/** A video with the browser's own controls, and a note when this browser cannot play its format. */
function VideoPreview({ name, sourceUrl, posterUrl, variant, autoPlay, t }: Readonly<{
  name: string;
  sourceUrl: string;
  posterUrl?: string | null;
  variant: AttachmentPreviewVariant;
  autoPlay?: boolean;
  t: (key: string) => string;
}>) {
  const [unsupported, setUnsupported] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2">
      <video
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        src={sourceUrl}
        poster={posterUrl ?? undefined}
        className={getVideoClassName(variant)}
        aria-label={name}
        onError={() => setUnsupported(true)}
      >
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} srcLang={t('languageCode')} label={t('captionsUnavailable')} default />
      </video>
      {unsupported && <p role="status" className="text-xs">{t('videoUnsupported')}</p>}
    </div>
  );
}

function AttachmentPreviewContent({
  name,
  mimetype,
  sourceUrl,
  variant = 'compact',
  posterUrl,
  autoPlay,
  t,
}: AttachmentPreviewContentProps) {
  if (!sourceUrl || !hasInlineAttachmentPreview(mimetype)) {
    return <AttachmentFileIcon />;
  }

  if (isImageAttachment(mimetype)) {
    return (
      <img
        src={sourceUrl}
        alt={name}
        className={getImageClassName(variant)}
        loading="lazy"
      />
    );
  }

  if (isAudioAttachment(mimetype)) {
    return (
      <audio controls preload="metadata" className="w-full" aria-label={name}>
        <source src={sourceUrl} type={mimetype} />
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} srcLang={t('languageCode')} label={t('captionsUnavailable')} default />
      </audio>
    );
  }

  if (isVideoAttachment(mimetype)) {
    return <VideoPreview name={name} sourceUrl={sourceUrl} posterUrl={posterUrl} variant={variant} autoPlay={autoPlay} t={t} />;
  }

  if (isPdfAttachment(mimetype) || isTextAttachment(mimetype)) {
    return (
      <iframe
        src={sourceUrl}
        title={name}
        className={getIframeClassName(variant)}
        loading="lazy"
      />
    );
  }

  return <AttachmentFileIcon />;
}

export default AttachmentPreviewContent;