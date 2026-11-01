import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createComfortReadsService, type ComfortRead } from '../../services/api/comfortReadsService';
import { writersToday } from '../../utils/entryDate';
import { callsForComfortReads, markOfferedOn, wasOfferedOn, type SavedEntry } from './comfortReadsState';

/**
 * The entries offered after the composer saves an entry with a very low mood: at most once a day per writer,
 * only when there are entries to offer (else nothing appears and the day stays open), and never the entry
 * just written. A later save, or `dismiss`, takes the offer away.
 */
export function useComfortReads(saved: SavedEntry | null, enabled: boolean) {
  const service = useAuthenticatedService(createComfortReadsService);
  const userId = useAuth().user?.id ?? null;
  const [offer, setOffer] = useState<{ saved: SavedEntry; entries: ComfortRead[] } | null>(null);

  useEffect(() => {
    if (!callsForComfortReads(saved, enabled) || userId === null) return undefined;
    const today = writersToday();
    if (wasOfferedOn(userId, today)) return undefined;
    let cancelled = false;
    void service.pick(saved.id).then(({ data }) => {
      if (cancelled || !data?.entries.length) return;
      markOfferedOn(userId, today);
      setOffer({ saved, entries: data.entries });
    });
    return () => { cancelled = true; };
  }, [enabled, saved, service, userId]);

  // An offer belongs to the save that asked for it, and to the setting being on
  const entries = enabled && offer && offer.saved === saved ? offer.entries : null;
  const dismiss = useCallback(() => setOffer(null), []);
  return { entries, dismiss };
}
