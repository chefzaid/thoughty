import { useEffect, useState } from 'react';
import { hasInlineAttachmentPreview } from '../../utils/attachments';

export function usePendingAttachmentPreviewUrl(file: File): string | null {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasInlineAttachmentPreview(file.type)) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return previewUrl;
}