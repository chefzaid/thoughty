import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreatedShareLink, ShareLink, ShareLinkDraft, ShareLinksService, ShareLinkTarget } from '../../services/api';

export interface ShareLinksState {
  readonly links: readonly ShareLink[];
  readonly limit: number | null;
  readonly activeCount: number;
  readonly loading: boolean;
  /** A translation key, or the API's coded reason, for the last thing that failed. */
  readonly error: string | null;
  /** The link just made, with its token: shown once, while the dialog stays open. */
  readonly created: CreatedShareLink | null;
  readonly creating: boolean;
  readonly revokingId: number | null;
  readonly revoked: boolean;
  readonly create: (draft: Omit<ShareLinkDraft, 'kind' | 'targetId'>) => Promise<boolean>;
  readonly revoke: (id: number) => Promise<void>;
}

/** The links of one entry or book version while its dialog is open; nothing is loaded while it is closed. */
export function useShareLinks(service: ShareLinksService, target: ShareLinkTarget, isOpen: boolean): ShareLinksState {
  const [links, setLinks] = useState<readonly ShareLink[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShareLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revoked, setRevoked] = useState(false);
  const generation = useRef(0);
  const { kind, id } = target;

  const load = useCallback(async () => {
    const current = generation.current;
    setLoading(true);
    const result = await service.list({ kind, id });
    if (current !== generation.current) return;
    setLoading(false);
    if (!result.data) {
      setError(result.error ?? 'shareLinksLoadFailed');
      return;
    }
    setLinks(result.data.links);
    setLimit(result.data.limit);
    setActiveCount(result.data.activeCount);
  }, [id, kind, service]);

  useEffect(() => {
    generation.current += 1;
    setCreated(null);
    setError(null);
    setRevoked(false);
    if (isOpen) {
      void load();
    } else {
      setLinks([]);
    }
  }, [isOpen, load]);

  const create = useCallback(async (draft: Omit<ShareLinkDraft, 'kind' | 'targetId'>): Promise<boolean> => {
    setCreating(true);
    setError(null);
    setRevoked(false);
    const result = await service.create({ ...draft, kind, targetId: id });
    setCreating(false);
    if (!result.data) {
      setError(result.error ?? 'shareLinkCreateFailed');
      return false;
    }
    setCreated(result.data);
    await load();
    return true;
  }, [id, kind, load, service]);

  const revoke = useCallback(async (linkId: number) => {
    setRevokingId(linkId);
    setError(null);
    setRevoked(false);
    const result = await service.revoke(linkId);
    setRevokingId(null);
    if (!result.data) {
      setError(result.error ?? 'shareLinkRevokeFailed');
      return;
    }
    setRevoked(true);
    setCreated((current) => (current?.id === linkId ? null : current));
    await load();
  }, [load, service]);

  return { links, limit, activeCount, loading, error, created, creating, revokingId, revoked, create, revoke };
}
