import { useEffect, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { getAttachmentUrl } from '../../utils/attachments';

export function useAuthenticatedAttachmentUrl(storedFilename: string): string | null {
  const { authFetch } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;
    setObjectUrl(null);

    void (async () => {
      try {
        const response = await authFetch(getAttachmentUrl(storedFilename));
        if (!response.ok) return;

        const nextObjectUrl = URL.createObjectURL(await response.blob());
        if (!active) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        currentObjectUrl = nextObjectUrl;
        setObjectUrl(nextObjectUrl);
      } catch {
        if (active) setObjectUrl(null);
      }
    })();

    return () => {
      active = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [authFetch, storedFilename]);

  return objectUrl;
}
