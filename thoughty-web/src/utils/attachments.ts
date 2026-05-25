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
] as const;

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

export function getAttachmentKindLabel(mimetype: string): string {
  if (isImageAttachment(mimetype)) {
    return 'Image';
  }
  if (isAudioAttachment(mimetype)) {
    return 'Audio';
  }
  if (isPdfAttachment(mimetype)) {
    return 'PDF';
  }
  if (isTextAttachment(mimetype)) {
    return 'Text';
  }
  return 'File';
}