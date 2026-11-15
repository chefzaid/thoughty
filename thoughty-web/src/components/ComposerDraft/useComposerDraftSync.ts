import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createComposerDraftService, type ComposerDraftFields } from '../../services/api/composerDraftService';
import {
  EMPTY_DRAFT_FIELDS,
  EMPTY_DRAFT_KEY,
  draftKey,
  fieldsOf,
  isEmptyDraft,
  planComposerDraft,
  type ComposerDraftOffer,
} from './composerDraftPlan';
import { readLocalComposerDraft, removeLocalComposerDraft, writeLocalComposerDraft } from './composerDraftStorage';
import { useLeaveWarning } from './useLeaveWarning';

/** How long typing pauses before the draft is saved, and the shortest time between two saves. */
export const DRAFT_SAVE_DELAY_MS = 2000;
export const DRAFT_MIN_SAVE_INTERVAL_MS = 3000;
/** When a save the API refused (not a conflict) is tried again. */
export const DRAFT_RETRY_MS = 30_000;

/** `offline`: saved on this device while the API cannot be reached; `local`: the API refused it for now. */
export type ComposerDraftStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'local';

export interface ComposerDraftSync {
  status: ComposerDraftStatus;
  offer: ComposerDraftOffer | null;
  /** Puts the draft saved elsewhere in the composer. */
  takeSavedDraft: () => void;
  /** Keeps this device's text and saves it over the draft saved elsewhere. */
  keepThisDraft: () => void;
  /** Discards the draft another device saved, leaving the composer as it is. */
  discardSavedDraft: () => void;
  /** Empties the composer of the draft another device published or discarded. */
  clearThisDraft: () => void;
  /** Saves now, as the writer leaves the composer. */
  flush: () => void;
  /** The draft became an entry: it goes from the server and this device. */
  onPublished: () => void;
}

/**
 * Keeps the composer's draft on the server as the writer types, so it continues on their other devices,
 * with a copy on this device for reloads and lost connections. Each save names the revision it was written
 * on; when another device got there first the writer chooses which text to keep. The page asks before it
 * closes on text the server does not have yet.
 */
export function useComposerDraftSync(fields: ComposerDraftFields, apply: (fields: ComposerDraftFields) => void): ComposerDraftSync {
  const userId = useAuth().user?.id ?? null;
  const service = useAuthenticatedService(createComposerDraftService);
  const [status, setStatus] = useState<ComposerDraftStatus>('idle');
  const [offer, setOffer] = useState<ComposerDraftOffer | null>(null);
  const [ready, setReady] = useState(false);
  const key = draftKey(fields);

  const latest = useRef({ fields, key, service, apply });
  latest.current = { fields, key, service, apply };
  const offerRef = useRef(offer);
  const baseRevision = useRef<number | null>(null);
  const syncedKey = useRef(EMPTY_DRAFT_KEY);
  const inFlight = useRef(false);
  /** Set for the shortest time between two saves after each one; a save asked for meanwhile waits for its end. */
  const coolingDown = useRef(false);
  const queued = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Grows when the draft is published or cleared, so a save still on its way is undone, not kept. */
  const epoch = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showOffer = useCallback((next: ComposerDraftOffer | null) => {
    offerRef.current = next;
    setOffer(next);
  }, []);

  const keepLocal = useCallback((current: ComposerDraftFields, currentKey: string) => {
    if (userId === null) return;
    if (isEmptyDraft(current)) {
      removeLocalComposerDraft(userId);
      return;
    }
    writeLocalComposerDraft(userId, { fields: current, baseRevision: baseRevision.current, synced: currentKey === syncedKey.current });
  }, [userId]);

  const reloadOffer = useCallback(async () => {
    const outcome = await latest.current.service.load();
    if (outcome.status === 'ok') {
      showOffer({ kind: outcome.data ? 'conflict' : 'gone', draft: outcome.data });
    }
    setStatus(outcome.status === 'offline' ? 'offline' : 'local');
  }, [showOffer]);

  const sync = useCallback(async (immediate = false): Promise<void> => {
    clearTimeout(timer.current);
    if (userId === null || offerRef.current || inFlight.current) return;
    const { fields: current, key: currentKey, service: drafts } = latest.current;
    if (currentKey === syncedKey.current) return;
    if (coolingDown.current && !immediate) {
      queued.current = true;
      return;
    }
    if (isEmptyDraft(current) && baseRevision.current === null) {
      // Nothing was saved from here: an emptied composer has nothing to discard
      syncedKey.current = currentKey;
      setStatus('idle');
      return;
    }

    const started = epoch.current;
    inFlight.current = true;
    coolingDown.current = true;
    clearTimeout(cooldown.current);
    cooldown.current = setTimeout(() => {
      coolingDown.current = false;
      if (queued.current) {
        queued.current = false;
        void syncRef.current();
      }
    }, DRAFT_MIN_SAVE_INTERVAL_MS);
    setStatus('saving');
    const outcome = isEmptyDraft(current)
      ? await drafts.discard(baseRevision.current)
      : await drafts.save(current, baseRevision.current);
    inFlight.current = false;

    if (started !== epoch.current) {
      // Published or cleared meanwhile: a draft this save left behind goes too
      if (outcome.status === 'ok' && outcome.data) void drafts.discard(outcome.data.revision);
      return;
    }
    if (outcome.status === 'ok') {
      baseRevision.current = outcome.data?.revision ?? null;
      syncedKey.current = currentKey;
      keepLocal(latest.current.fields, latest.current.key);
      if (latest.current.key === currentKey) {
        setStatus(outcome.data ? 'saved' : 'idle');
      } else {
        timer.current = setTimeout(() => void sync(), DRAFT_SAVE_DELAY_MS);
      }
    } else if (outcome.status === 'conflict') {
      await reloadOffer();
    } else if (outcome.status === 'offline') {
      setStatus('offline');
    } else {
      setStatus('local');
      timer.current = setTimeout(() => void sync(), DRAFT_RETRY_MS);
    }
  }, [keepLocal, reloadOffer, userId]);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  // On sign-in: this device's copy and the server's draft decide where the composer starts
  useEffect(() => {
    setReady(false);
    showOffer(null);
    setStatus('idle');
    baseRevision.current = null;
    syncedKey.current = EMPTY_DRAFT_KEY;
    if (userId === null) return undefined;
    let cancelled = false;
    void (async () => {
      const local = readLocalComposerDraft(userId);
      const outcome = await latest.current.service.load();
      if (cancelled) return;
      const plan = planComposerDraft(local, outcome.status === 'ok' ? outcome.data : undefined, isEmptyDraft(latest.current.fields));
      baseRevision.current = plan.baseRevision;
      syncedKey.current = plan.syncedKey;
      if (plan.clearLocal) removeLocalComposerDraft(userId);
      if (plan.apply) latest.current.apply(plan.apply);
      showOffer(plan.offer);
      if (outcome.status === 'offline' || outcome.status === 'failed') {
        setStatus(outcome.status === 'offline' ? 'offline' : 'local');
      } else if (plan.apply && plan.syncedKey === draftKey(plan.apply)) {
        setStatus('saved');
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [showOffer, userId]);

  // Every change is kept on this device at once, and saved to the server once typing pauses
  useEffect(() => {
    if (!ready) return;
    keepLocal(latest.current.fields, key);
    if (key === syncedKey.current || offerRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void sync(), DRAFT_SAVE_DELAY_MS);
  }, [key, keepLocal, ready, sync]);

  const flush = useCallback(() => {
    if (ready) void sync(true);
  }, [ready, sync]);

  // Leaving the page or the app saves at once; a connection coming back sends what waited
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    globalThis.addEventListener('online', flush);
    globalThis.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      globalThis.removeEventListener('online', flush);
      globalThis.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flush]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(cooldown.current);
  }, []);

  useLeaveWarning(useCallback(
    () => !isEmptyDraft(latest.current.fields) && (inFlight.current || latest.current.key !== syncedKey.current),
    [],
  ));

  const takeSavedDraft = useCallback(() => {
    const draft = offerRef.current?.draft;
    if (!draft) return;
    const restored = fieldsOf(draft);
    baseRevision.current = draft.revision;
    syncedKey.current = draftKey(restored);
    showOffer(null);
    latest.current.apply(restored);
    setStatus('saved');
  }, [showOffer]);

  const keepThisDraft = useCallback(() => {
    const draft = offerRef.current?.draft ?? null;
    baseRevision.current = draft?.revision ?? null;
    syncedKey.current = draft ? draftKey(fieldsOf(draft)) : EMPTY_DRAFT_KEY;
    showOffer(null);
    void sync(true);
  }, [showOffer, sync]);

  const discardSavedDraft = useCallback(() => {
    const draft = offerRef.current?.draft;
    if (!draft) return;
    void latest.current.service.discard(draft.revision).then((outcome) => {
      if (outcome.status === 'conflict') {
        void reloadOffer();
        return;
      }
      if (outcome.status !== 'ok') {
        setStatus(outcome.status === 'offline' ? 'offline' : 'local');
        return;
      }
      baseRevision.current = null;
      syncedKey.current = EMPTY_DRAFT_KEY;
      showOffer(null);
      setStatus('idle');
    });
  }, [reloadOffer, showOffer]);

  const forgetDraft = useCallback(() => {
    epoch.current += 1;
    clearTimeout(timer.current);
    baseRevision.current = null;
    syncedKey.current = EMPTY_DRAFT_KEY;
    if (userId !== null) removeLocalComposerDraft(userId);
    setStatus('idle');
  }, [userId]);

  const clearThisDraft = useCallback(() => {
    forgetDraft();
    showOffer(null);
    latest.current.apply(EMPTY_DRAFT_FIELDS);
  }, [forgetDraft, showOffer]);

  const onPublished = useCallback(() => {
    const published = baseRevision.current;
    forgetDraft();
    // A newer draft saved on another device meanwhile is kept for later
    if (published !== null) void latest.current.service.discard(published);
  }, [forgetDraft]);

  return { status, offer, takeSavedDraft, keepThisDraft, discardSavedDraft, clearThisDraft, flush, onPublished };
}
