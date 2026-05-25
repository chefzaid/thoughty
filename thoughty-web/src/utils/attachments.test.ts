import { describe, expect, it } from 'vitest';
import {
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

  it('returns human-readable attachment labels', () => {
    expect(getAttachmentKindLabel('image/png')).toBe('Image');
    expect(getAttachmentKindLabel('audio/mpeg')).toBe('Audio');
    expect(getAttachmentKindLabel('application/pdf')).toBe('PDF');
    expect(getAttachmentKindLabel('text/plain')).toBe('Text');
    expect(getAttachmentKindLabel('application/octet-stream')).toBe('File');
  });
});