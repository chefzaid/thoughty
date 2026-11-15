import type { ComposerDraft, ComposerDraftFields } from '../../services/api/composerDraftService';
import type { LocalComposerDraft } from './composerDraftStorage';

/**
 * What to ask about a draft saved elsewhere: `restore` offers the draft another device saved to an empty
 * composer, `conflict` says this device's text and a newer saved draft differ, and `gone` says the draft
 * this device was writing was published or discarded on another one.
 */
export interface ComposerDraftOffer {
  kind: 'restore' | 'conflict' | 'gone';
  draft: ComposerDraft | null;
}

export const EMPTY_DRAFT_FIELDS: ComposerDraftFields = { text: '', title: null, tags: [], format: 'plain', mood: null, feelings: [] };

/** A comparable key for a set of fields, the same for equal fields whatever their order. */
export const draftKey = (fields: ComposerDraftFields): string => JSON.stringify([
  fields.text, fields.title, fields.tags, fields.format, fields.mood, fields.feelings,
]);

export const EMPTY_DRAFT_KEY = draftKey(EMPTY_DRAFT_FIELDS);

/** A composer with no text and no title holds no draft, whatever its tags or mood. */
export const isEmptyDraft = (fields: ComposerDraftFields): boolean => !fields.text.trim() && !fields.title?.trim();

export const fieldsOf = ({ text, title, tags, format, mood, feelings }: ComposerDraftFields): ComposerDraftFields => (
  { text, title, tags, format, mood, feelings }
);

/** Where the composer starts once the draft on this device and the one on the server are both known. */
export interface ComposerDraftPlan {
  /** Fields to put in the composer, when it is empty. */
  apply: ComposerDraftFields | null;
  /** The server revision the composer's text is written on. */
  baseRevision: number | null;
  /** The fields the server holds, as far as this device knows. */
  syncedKey: string;
  offer: ComposerDraftOffer | null;
  /** Whether this device's copy is stale and goes. */
  clearLocal: boolean;
}

/**
 * Plans the composer's start. `server` is undefined when the API could not be reached: this device's copy
 * comes back and is sent once the API answers. A copy this device never sent is restored, and is sent when
 * the server is where it left it; otherwise the writer chooses. A draft saved on another device is offered,
 * never put in silently, while one this device saved last comes back as it was.
 */
export function planComposerDraft(
  local: LocalComposerDraft | null,
  server: ComposerDraft | null | undefined,
  composerEmpty: boolean,
): ComposerDraftPlan {
  const restoreLocal = local && composerEmpty ? local.fields : null;
  if (server === undefined) {
    return {
      apply: restoreLocal,
      baseRevision: local?.baseRevision ?? null,
      syncedKey: local?.synced ? draftKey(local.fields) : EMPTY_DRAFT_KEY,
      offer: null,
      clearLocal: false,
    };
  }

  const serverKey = server ? draftKey(server) : EMPTY_DRAFT_KEY;
  if (local && !local.synced) {
    const sameRevision = (server?.revision ?? null) === local.baseRevision;
    let offer: ComposerDraftOffer | null = null;
    if (!sameRevision) offer = { kind: server ? 'conflict' : 'gone', draft: server };
    return { apply: restoreLocal, baseRevision: local.baseRevision, syncedKey: serverKey, offer, clearLocal: false };
  }

  if (!server) {
    return { apply: null, baseRevision: null, syncedKey: EMPTY_DRAFT_KEY, offer: null, clearLocal: local !== null };
  }
  if (composerEmpty && local?.baseRevision === server.revision) {
    return { apply: fieldsOf(server), baseRevision: server.revision, syncedKey: serverKey, offer: null, clearLocal: false };
  }
  return {
    apply: null,
    baseRevision: local?.baseRevision ?? null,
    syncedKey: serverKey,
    offer: { kind: composerEmpty ? 'restore' : 'conflict', draft: server },
    clearLocal: false,
  };
}
