import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAttachmentsService } from './attachmentsService';

describe('createAttachmentsService', () => {
  let authFetch: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createAttachmentsService>;

  beforeEach(() => {
    authFetch = vi.fn();
    service = createAttachmentsService(authFetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadAttachment', () => {
    it('uploads a file successfully', async () => {
      const mockAttachment = {
        id: 1,
        original_filename: 'photo.jpg',
        stored_filename: 'uuid.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAttachment),
      });

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await service.uploadAttachment(file);

      expect(authFetch).toHaveBeenCalledWith('/api/attachments/upload', {
        method: 'POST',
        body: expect.any(FormData),
        headers: {},
      });
      expect(result).toEqual(mockAttachment);
    });

    it('includes entryId in FormData when provided', async () => {
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      await service.uploadAttachment(file, 42);

      const formData = authFetch.mock.calls[0][1].body as FormData;
      expect(formData.get('entryId')).toBe('42');
    });

    it('returns null on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await service.uploadAttachment(file);

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      authFetch.mockRejectedValue(new Error('Network error'));

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await service.uploadAttachment(file);

      expect(result).toBeNull();
    });
  });

  describe('getAttachmentsByEntry', () => {
    it('returns attachments for an entry', async () => {
      const mockAttachments = [
        { id: 1, original_filename: 'a.jpg' },
        { id: 2, original_filename: 'b.pdf' },
      ];
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAttachments),
      });

      const result = await service.getAttachmentsByEntry(10);

      expect(authFetch).toHaveBeenCalledWith('/api/attachments/entry/10');
      expect(result).toEqual(mockAttachments);
    });

    it('returns empty array on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });
      const result = await service.getAttachmentsByEntry(10);
      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      authFetch.mockRejectedValue(new Error('fail'));
      const result = await service.getAttachmentsByEntry(10);
      expect(result).toEqual([]);
    });
  });

  describe('linkAttachment', () => {
    it('links an attachment to an entry', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.linkAttachment(1, 10);

      expect(authFetch).toHaveBeenCalledWith('/api/attachments/1/link', {
        method: 'POST',
        body: JSON.stringify({ entryId: 10 }),
      });
      expect(result).toBe(true);
    });

    it('returns false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });
      const result = await service.linkAttachment(1, 10);
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      authFetch.mockRejectedValue(new Error('fail'));
      const result = await service.linkAttachment(1, 10);
      expect(result).toBe(false);
    });
  });

  describe('deleteAttachment', () => {
    it('deletes an attachment', async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.deleteAttachment(1);

      expect(authFetch).toHaveBeenCalledWith('/api/attachments/1', {
        method: 'DELETE',
      });
      expect(result).toBe(true);
    });

    it('returns false on failure', async () => {
      authFetch.mockResolvedValue({ ok: false });
      const result = await service.deleteAttachment(1);
      expect(result).toBe(false);
    });
  });

  describe('getAttachmentUrl', () => {
    it('returns the correct URL', () => {
      const url = service.getAttachmentUrl('uuid-file.jpg');
      expect(url).toBe('/api/attachments/file/uuid-file.jpg');
    });
  });
});
