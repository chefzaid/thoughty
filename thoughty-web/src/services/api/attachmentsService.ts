import type { Attachment } from '../../types';

export const createAttachmentsService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {

  const uploadAttachment = async (file: File, entryId?: number): Promise<Attachment | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (entryId) {
        formData.append('entryId', entryId.toString());
      }

      const response = await authFetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type with boundary for multipart
      });

      if (response.ok) {
        return await response.json() as Attachment;
      }
      return null;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return null;
    }
  };

  const getAttachmentsByEntry = async (entryId: number): Promise<Attachment[]> => {
    try {
      const response = await authFetch(`/api/attachments/entry/${entryId}`);
      if (response.ok) {
        return await response.json() as Attachment[];
      }
      return [];
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  };

  const linkAttachment = async (attachmentId: number, entryId: number): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/attachments/${attachmentId}/link`, {
        method: 'POST',
        body: JSON.stringify({ entryId }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error linking attachment:', error);
      return false;
    }
  };

  const deleteAttachment = async (id: number): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/attachments/${id}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return false;
    }
  };

  const getAttachmentUrl = (storedFilename: string): string => {
    return `/api/attachments/file/${storedFilename}`;
  };

  return {
    uploadAttachment,
    getAttachmentsByEntry,
    linkAttachment,
    deleteAttachment,
    getAttachmentUrl,
  };
};

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
