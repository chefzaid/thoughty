import { describe, expect, it } from 'vitest';
import { translations, type TranslationKey } from './translations';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
  maxAttachmentBytes,
  isVideoAttachment,
  formatAttachmentSize,
  getAttachmentKindLabel,
  hasInlineAttachmentPreview,
  isAudioAttachment,
  isImageAttachment,
  isPdfAttachment,
  isTextAttachment,
} from './attachments';

describe('attachment utils', () => {
  it('detects supported preview attachment kinds', () => {
    expect(isImageAttachment('image/jpeg')).toBe(true);
    expect(isAudioAttachment('audio/mpeg')).toBe(true);
    expect(isPdfAttachment('application/pdf')).toBe(true);
    expect(isTextAttachment('text/plain')).toBe(true);
    expect(hasInlineAttachmentPreview('text/plain')).toBe(true);
    expect(hasInlineAttachmentPreview('application/octet-stream')).toBe(false);
  });

  it('formats sizes consistently', () => {
    expect(formatAttachmentSize(512)).toBe('512 B');
    expect(formatAttachmentSize(2048)).toBe('2.0 KB');
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('names each kind of attachment in the reader’s language', () => {
    const t = (key: string) => translations.fr[key as TranslationKey];
    expect(getAttachmentKindLabel('image/png', t)).toBe('Image');
    expect(getAttachmentKindLabel('audio/mpeg', t)).toBe('Audio');
    expect(getAttachmentKindLabel('video/mp4', t)).toBe('Vidéo');
    expect(getAttachmentKindLabel('application/pdf', t)).toBe('PDF');
    expect(getAttachmentKindLabel('text/plain', t)).toBe('Texte');
    expect(getAttachmentKindLabel('application/octet-stream', t)).toBe('Fichier');
  });

  it('gives videos their own 50 MB limit and an inline player', () => {
    expect(isVideoAttachment('video/quicktime')).toBe(true);
    expect(isVideoAttachment('audio/mp4')).toBe(false);
    expect(hasInlineAttachmentPreview('video/webm')).toBe(true);
    expect(maxAttachmentBytes('video/mp4')).toBe(MAX_VIDEO_BYTES);
    expect(MAX_VIDEO_BYTES).toBe(50 * 1024 * 1024);
    expect(maxAttachmentBytes('image/png')).toBe(MAX_ATTACHMENT_BYTES);
    expect(ALLOWED_ATTACHMENT_TYPES).toEqual(expect.arrayContaining(['video/mp4', 'video/webm', 'video/quicktime']));
  });
});