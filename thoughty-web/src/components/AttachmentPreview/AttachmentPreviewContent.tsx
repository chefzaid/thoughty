import {
  EMPTY_CAPTIONS_TRACK_URL,
  isAudioAttachment,
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

function AttachmentPreviewContent({
  name,
  mimetype,
  sourceUrl,
  variant = 'compact',
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
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} srcLang="en" label="No captions available" default />
      </audio>
    );
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