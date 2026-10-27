import { useEffect, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { getAttachmentUrl } from '../../utils/attachments';

export interface AttachmentResource {
  /** A local URL for the file once it is loaded. */
  readonly url: string | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'failed';
}

const IDLE: AttachmentResource = { url: null, status: 'idle' };

/**
 * A stored file fetched with the session into a local URL, with where the fetch stands. Nothing is
 * fetched while `storedFilename` is null; a new `attempt` fetches it again after a failure.
 */
export function useAuthenticatedAttachmentResource(storedFilename: string | null, attempt = 0): AttachmentResource {
  const { authFetch } = useAuth();
  const [resource, setResource] = useState<AttachmentResource>(IDLE);

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;
    if (storedFilename === null) {
      setResource(IDLE);
      return undefined;
    }
    setResource({ url: null, status: 'loading' });

    void (async () => {
      try {
        const response = await authFetch(getAttachmentUrl(storedFilename));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const nextObjectUrl = URL.createObjectURL(await response.blob());
        if (!active) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        currentObjectUrl = nextObjectUrl;
        setResource({ url: nextObjectUrl, status: 'ready' });
      } catch {
        if (active) setResource({ url: null, status: 'failed' });
      }
    })();

    return () => {
      active = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [authFetch, storedFilename, attempt]);

  return resource;
}

/** A local URL for the stored file, fetched with the session; nothing is fetched while `storedFilename` is null. */
export function useAuthenticatedAttachmentUrl(storedFilename: string | null): string | null {
  return useAuthenticatedAttachmentResource(storedFilename).url;
}
