import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type ContentLockStatus = components['schemas']['ContentLockStatusDto'];
export type ContentUnlock = components['schemas']['ContentUnlockResponseDto'];
export type ContentPinProof = components['schemas']['ContentPinProofDto'];
export type TwoFactorChallenge = components['schemas']['TwoFactorChallengeResponseDto'];
/** What changing or removing the PIN answers: done, or the emailed-code challenge to answer first. */
export type ContentPinChange = { success: true } | TwoFactorChallenge;
export type Diary = components['schemas']['DiaryResponseDto'];
export type EntryMutation = components['schemas']['EntryMutationResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The PIN lock of diaries and entries: the PIN, the unlock it gives, and the locks themselves. */
export const createContentLockService = (authFetch: AuthFetchFunction) => ({
  status(): Promise<ServiceResult<ContentLockStatus>> {
    return requestJson(authFetch('/api/content-lock'), 'pinLockLoadFailed');
  },

  /** Sets a first PIN, or changes it with a proof (the current PIN, or the password and maybe an emailed code). */
  setPin(pin: string, proof: ContentPinProof = {}): Promise<ServiceResult<ContentPinChange>> {
    return requestJson(authFetch('/api/content-lock/pin', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ pin, ...proof }) }), 'pinSaveFailed');
  },

  /** Removes the PIN and every lock, with the same proof. */
  removePin(proof: ContentPinProof): Promise<ServiceResult<ContentPinChange>> {
    return requestJson(authFetch('/api/content-lock/pin/remove', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(proof) }), 'pinSaveFailed');
  },

  unlock(pin: string): Promise<ServiceResult<ContentUnlock>> {
    return requestJson(authFetch('/api/content-lock/unlock', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ pin }) }), 'pinUnlockFailed');
  },

  /** Ends the unlock the request carries, on the server too. */
  lock(): Promise<ServiceResult<{ success: boolean }>> {
    return requestJson(authFetch('/api/content-lock/unlock', { method: 'DELETE' }), 'pinLockFailed');
  },

  setEntryLocked(entryId: number, locked: boolean): Promise<ServiceResult<EntryMutation>> {
    return requestJson(authFetch(`/api/entries/${entryId}/lock`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ locked }) }), 'pinLockChangeFailed');
  },

  setDiaryLocked(diaryId: number, locked: boolean): Promise<ServiceResult<Diary>> {
    return requestJson(authFetch(`/api/diaries/${diaryId}/lock`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ locked }) }), 'pinLockChangeFailed');
  },
});

export type ContentLockService = ReturnType<typeof createContentLockService>;
