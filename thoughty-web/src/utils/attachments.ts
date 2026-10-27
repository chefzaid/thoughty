export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

const MIB = 1024 * 1024;
/** The API's limits: 50 MB for a video, 5 MB for any other file. */
export const MAX_ATTACHMENT_BYTES = 5 * MIB;
export const MAX_VIDEO_BYTES = 50 * MIB;

export function maxAttachmentBytes(mimetype: string): number {
  return isVideoAttachment(mimetype) ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES;
}

export const EMPTY_CAPTIONS_TRACK_URL = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A';

export function getAttachmentUrl(storedFilename: string): string {
  return `/api/attachments/file/${storedFilename}`;
}

export function isImageAttachment(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

export function isAudioAttachment(mimetype: string): boolean {
  return mimetype.startsWith('audio/');
}

export function isVideoAttachment(mimetype: string): boolean {
  return mimetype.startsWith('video/');
}

export function isPdfAttachment(mimetype: string): boolean {
  return mimetype === 'application/pdf';
}

export function isTextAttachment(mimetype: string): boolean {
  return mimetype.startsWith('text/');
}

export function hasInlineAttachmentPreview(mimetype: string): boolean {
  return (
    isImageAttachment(mimetype)
    || isAudioAttachment(mimetype)
    || isVideoAttachment(mimetype)
    || isPdfAttachment(mimetype)
    || isTextAttachment(mimetype)
  );
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What kind of file an attachment is, in the reader's language. */
export function getAttachmentKindLabel(mimetype: string, t: (key: string) => string): string {
  if (isImageAttachment(mimetype)) {
    return t('attachmentKindImage');
  }
  if (isAudioAttachment(mimetype)) {
    return t('attachmentKindAudio');
  }
  if (isVideoAttachment(mimetype)) {
    return t('attachmentKindVideo');
  }
  if (isPdfAttachment(mimetype)) {
    return t('attachmentKindPdf');
  }
  if (isTextAttachment(mimetype)) {
    return t('attachmentKindText');
  }
  return t('attachmentKindFile');
}
