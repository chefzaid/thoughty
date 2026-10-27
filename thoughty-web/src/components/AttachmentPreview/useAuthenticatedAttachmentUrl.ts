import { useEffect, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { getAttachmentUrl } from '../../utils/attachments';

/** A local URL for the stored file, fetched with the session; nothing is fetched while `storedFilename` is null. */
export function useAuthenticatedAttachmentUrl(storedFilename: string | null): string | null {
  const { authFetch } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;
    setObjectUrl(null);
    if (storedFilename === null) {
      return undefined;
    }

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
