import { useCallback, useRef } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createAttachmentsService } from '../../services/api';

/** Uploads a voice answer once, however many times it is transcribed or saved; null when the upload fails. */
export function useRecordingUpload() {
  const attachmentsService = useAuthenticatedService(createAttachmentsService);
  const uploaded = useRef<{ file: File; id: number } | null>(null);

  const upload = useCallback(async (file: File): Promise<number | null> => {
    if (uploaded.current?.file === file) return uploaded.current.id;
    const attachment = await attachmentsService.uploadAttachment(file);
    if (!attachment) return null;
    uploaded.current = { file, id: attachment.id };
    return attachment.id;
  }, [attachmentsService]);

  return { upload, attachmentsService };
}
