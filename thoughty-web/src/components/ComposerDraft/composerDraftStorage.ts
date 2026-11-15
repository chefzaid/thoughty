import type { ComposerDraftFields } from '../../services/api/composerDraftService';

/**
 * This device's copy of the composer draft, so a reload or a lost connection never loses it: the fields,
 * the server revision they were written on, and whether the server holds them yet. It is private text, so
 * it goes when the writer signs out (`forgetLocalComposerDrafts`).
 */
export interface LocalComposerDraft {
  fields: ComposerDraftFields;
  baseRevision: number | null;
  synced: boolean;
}

const STORAGE_PREFIX = 'thoughty.composerDraft.';

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function isFields(value: unknown): value is ComposerDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return typeof fields.text === 'string'
    && (fields.title === null || typeof fields.title === 'string')
    && isStringList(fields.tags)
    && (fields.format === 'plain' || fields.format === 'markdown')
    && (fields.mood === null || typeof fields.mood === 'number')
    && isStringList(fields.feelings);
}

function isLocalDraft(value: unknown): value is LocalComposerDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return isFields(draft.fields)
    && (draft.baseRevision === null || (typeof draft.baseRevision === 'number' && Number.isInteger(draft.baseRevision)))
    && typeof draft.synced === 'boolean';
}

/** The writer's draft on this device, or null when there is none or it cannot be read. */
export function readLocalComposerDraft(userId: number): LocalComposerDraft | null {
  try {
    const stored = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${userId}`);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isLocalDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalComposerDraft(userId: number, draft: LocalComposerDraft): void {
  try {
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the draft still lives in the composer and on the server
  }
}

export function removeLocalComposerDraft(userId: number): void {
  try {
    globalThis.localStorage?.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    // Nothing to remove when storage is blocked
  }
}

/** Removes every writer's draft from this device, as the writer signs out. */
export function forgetLocalComposerDrafts(): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key?.startsWith(STORAGE_PREFIX) ?? false);
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to remove when storage is blocked
  }
}
