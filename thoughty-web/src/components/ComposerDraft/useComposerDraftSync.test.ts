import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComposerDraft, ComposerDraftFields, DraftOutcome } from '../../services/api/composerDraftService';
import { EMPTY_DRAFT_FIELDS } from './composerDraftPlan';
import { readLocalComposerDraft, writeLocalComposerDraft } from './composerDraftStorage';
import { DRAFT_MIN_SAVE_INTERVAL_MS, DRAFT_RETRY_MS, DRAFT_SAVE_DELAY_MS, useComposerDraftSync } from './useComposerDraftSync';

const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null }));
const service = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), discard: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const fields = (text: string, extra: Partial<ComposerDraftFields> = {}): ComposerDraftFields => ({ ...EMPTY_DRAFT_FIELDS, text, ...extra });
const saved = (text: string, revision: number, extra: Partial<ComposerDraft> = {}): ComposerDraft => ({
  ...fields(text), revision, updatedAt: '2026-11-15T09:30:00.000Z', ...extra,
});
const ok = <T,>(data: T): DraftOutcome<T> => ({ status: 'ok', data });

function renderDraft(initial: ComposerDraftFields = EMPTY_DRAFT_FIELDS) {
  return renderHook(() => {
    const [current, setCurrent] = useState(initial);
    return { fields: current, setFields: setCurrent, draft: useComposerDraftSync(current, setCurrent) };
  });
}

type Rendered = ReturnType<typeof renderDraft>['result'];

/** Lets the pending promises settle, inside act. */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const type = async (result: Rendered, text: string) => {
  act(() => result.current.setFields((previous) => ({ ...previous, text })));
  await settle();
};
const wait = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

describe('useComposerDraftSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    auth.user = { id: 7 };
    service.load.mockReset().mockResolvedValue(ok(null));
    service.save.mockReset();
    service.discard.mockReset().mockResolvedValue(ok(null));
  });
  afterEach(() => vi.useRealTimers());

  it('saves once typing pauses, keeps a copy on this device, and saves later changes on top of the revision', async () => {
    service.save.mockResolvedValueOnce(ok(saved('Hello', 1))).mockResolvedValueOnce(ok(saved('Hello there', 2)));
    const { result } = renderDraft();
    await settle();

    await type(result, 'Hello');
    expect(readLocalComposerDraft(7)).toEqual({ fields: fields('Hello'), baseRevision: null, synced: false });
    expect(service.save).not.toHaveBeenCalled();
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(service.save).toHaveBeenCalledWith(fields('Hello'), null);
    expect(result.current.draft.status).toBe('saved');
    expect(readLocalComposerDraft(7)).toEqual({ fields: fields('Hello'), baseRevision: 1, synced: true });

    await type(result, 'Hello there');
    await wait(DRAFT_SAVE_DELAY_MS);
    // Saves are at least the minimum interval apart
    expect(service.save).toHaveBeenCalledTimes(1);
    await wait(DRAFT_MIN_SAVE_INTERVAL_MS);
    expect(service.save).toHaveBeenLastCalledWith(fields('Hello there'), 1);
  });

  it('saves at once as the writer leaves, and discards what this device saved once the composer is emptied', async () => {
    service.save.mockResolvedValue(ok(saved('Hello', 3)));
    const { result } = renderDraft();
    await settle();

    await type(result, 'Hello');
    await act(async () => { result.current.draft.flush(); });
    await settle();
    expect(service.save).toHaveBeenCalledWith(fields('Hello'), null);

    await type(result, '  ');
    await wait(DRAFT_SAVE_DELAY_MS + DRAFT_MIN_SAVE_INTERVAL_MS);
    expect(service.discard).toHaveBeenCalledWith(3);
    expect(result.current.draft.status).toBe('idle');
    expect(readLocalComposerDraft(7)).toBeNull();
  });

  it('offers a draft another device saved, and continues it on its revision', async () => {
    service.load.mockResolvedValue(ok(saved('From the phone', 4, { title: 'Walk' })));
    service.save.mockResolvedValue(ok(saved('From the phone, and more', 5)));
    const { result } = renderDraft();
    await settle();

    expect(result.current.draft.offer).toEqual({ kind: 'restore', draft: expect.objectContaining({ revision: 4 }) });
    expect(result.current.fields.text).toBe('');
    act(() => result.current.draft.takeSavedDraft());
    expect(result.current.fields).toEqual(fields('From the phone', { title: 'Walk' }));
    expect(result.current.draft.offer).toBeNull();
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(service.save).not.toHaveBeenCalled();

    await type(result, 'From the phone, and more');
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(service.save).toHaveBeenCalledWith(fields('From the phone, and more', { title: 'Walk' }), 4);
  });

  it('brings back the draft this device saved last without asking', async () => {
    writeLocalComposerDraft(7, { fields: fields('Mine'), baseRevision: 2, synced: true });
    service.load.mockResolvedValue(ok(saved('Mine', 2)));
    const { result } = renderDraft();
    await settle();

    expect(result.current.draft.offer).toBeNull();
    expect(result.current.fields.text).toBe('Mine');
    expect(result.current.draft.status).toBe('saved');
  });

  it('discards an offered draft at its revision, and offers again one saved meanwhile', async () => {
    service.load.mockResolvedValueOnce(ok(saved('Old', 4))).mockResolvedValueOnce(ok(saved('Newer', 5)));
    service.discard.mockResolvedValueOnce({ status: 'conflict' }).mockResolvedValueOnce(ok(null));
    const { result } = renderDraft();
    await settle();

    act(() => result.current.draft.discardSavedDraft());
    await settle();
    expect(service.discard).toHaveBeenCalledWith(4);
    expect(result.current.draft.offer).toEqual({ kind: 'conflict', draft: expect.objectContaining({ revision: 5 }) });

    act(() => result.current.draft.discardSavedDraft());
    await settle();
    expect(service.discard).toHaveBeenLastCalledWith(5);
    expect(result.current.draft.offer).toBeNull();
  });

  it('asks which text to keep when another device saved first, and can keep this one', async () => {
    service.save.mockResolvedValueOnce({ status: 'conflict' }).mockResolvedValueOnce(ok(saved('Laptop text', 7)));
    const { result } = renderDraft();
    await settle();
    service.load.mockResolvedValue(ok(saved('Phone text', 6)));

    await type(result, 'Laptop text');
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(result.current.draft.offer).toEqual({ kind: 'conflict', draft: expect.objectContaining({ revision: 6 }) });
    expect(result.current.draft.status).toBe('local');

    // While the writer has not chosen, nothing more is sent
    await type(result, 'Laptop text, more');
    await wait(DRAFT_SAVE_DELAY_MS + DRAFT_MIN_SAVE_INTERVAL_MS);
    expect(service.save).toHaveBeenCalledTimes(1);

    act(() => result.current.draft.keepThisDraft());
    await settle();
    expect(service.save).toHaveBeenLastCalledWith(fields('Laptop text, more'), 6);
  });

  it('keeps a draft published elsewhere, or clears it, as the writer chooses', async () => {
    writeLocalComposerDraft(7, { fields: fields('Unsent'), baseRevision: 3, synced: false });
    const { result } = renderDraft();
    await settle();

    expect(result.current.fields.text).toBe('Unsent');
    expect(result.current.draft.offer).toEqual({ kind: 'gone', draft: null });
    act(() => result.current.draft.clearThisDraft());
    expect(result.current.fields).toEqual(EMPTY_DRAFT_FIELDS);
    expect(readLocalComposerDraft(7)).toBeNull();
    expect(result.current.draft.offer).toBeNull();
  });

  it('works offline on this device and sends the draft when the connection is back', async () => {
    service.load.mockResolvedValue({ status: 'offline' });
    writeLocalComposerDraft(7, { fields: fields('On the train'), baseRevision: 1, synced: false });
    service.save.mockResolvedValueOnce({ status: 'offline' }).mockResolvedValueOnce(ok(saved('On the train, later', 2)));
    const { result } = renderDraft();
    await settle();

    expect(result.current.fields.text).toBe('On the train');
    expect(result.current.draft.status).toBe('offline');
    await type(result, 'On the train, later');
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(result.current.draft.status).toBe('offline');

    await act(async () => { globalThis.dispatchEvent(new Event('online')); });
    await settle();
    expect(service.save).toHaveBeenLastCalledWith(fields('On the train, later'), 1);
    expect(result.current.draft.status).toBe('saved');
  });

  it('tries again later when the API refuses a save', async () => {
    service.save.mockResolvedValueOnce({ status: 'failed' }).mockResolvedValueOnce(ok(saved('Hello', 1)));
    const { result } = renderDraft();
    await settle();

    await type(result, 'Hello');
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(result.current.draft.status).toBe('local');
    await wait(DRAFT_RETRY_MS);
    expect(service.save).toHaveBeenCalledTimes(2);
    expect(result.current.draft.status).toBe('saved');
  });

  it('discards the draft once published, also one a save still on its way left', async () => {
    let finishSave: (outcome: DraftOutcome<ComposerDraft>) => void = () => undefined;
    service.save.mockResolvedValueOnce(ok(saved('Hello', 1)))
      .mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    const { result } = renderDraft();
    await settle();
    await type(result, 'Hello');
    await wait(DRAFT_SAVE_DELAY_MS);

    await type(result, 'Hello again');
    await wait(DRAFT_SAVE_DELAY_MS + DRAFT_MIN_SAVE_INTERVAL_MS);
    act(() => {
      result.current.draft.onPublished();
      result.current.setFields(EMPTY_DRAFT_FIELDS);
    });
    expect(service.discard).toHaveBeenCalledWith(1);
    await act(async () => { finishSave(ok(saved('Hello again', 2))); });
    await settle();
    expect(service.discard).toHaveBeenLastCalledWith(2);
    expect(readLocalComposerDraft(7)).toBeNull();
    expect(result.current.draft.status).toBe('idle');
  });

  it('asks before the page closes on text the server does not have yet', async () => {
    service.save.mockResolvedValue(ok(saved('Hello', 1)));
    const { result } = renderDraft();
    await settle();
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true });
      globalThis.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(leave()).toBe(false);
    await type(result, 'Hello');
    expect(leave()).toBe(true);
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(leave()).toBe(false);
  });

  it('saves at once when the tab is hidden, not when it is shown', async () => {
    service.save.mockResolvedValue(ok(saved('Hello', 1)));
    const { result } = renderDraft();
    await settle();
    await type(result, 'Hello');
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(service.save).not.toHaveBeenCalled();
    visibility.mockReturnValue('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await settle();
    expect(service.save).toHaveBeenCalledWith(fields('Hello'), null);
    visibility.mockRestore();
  });

  it('saves again what was typed while a save was on its way', async () => {
    let finish: (outcome: DraftOutcome<ComposerDraft>) => void = () => undefined;
    service.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(ok(saved('Hello there', 2)));
    const { result } = renderDraft();
    await settle();
    await type(result, 'Hello');
    await wait(DRAFT_SAVE_DELAY_MS);

    await type(result, 'Hello there');
    await act(async () => { finish(ok(saved('Hello', 1))); });
    await settle();
    expect(readLocalComposerDraft(7)).toEqual({ fields: fields('Hello there'), baseRevision: 1, synced: false });
    await wait(DRAFT_SAVE_DELAY_MS + DRAFT_MIN_SAVE_INTERVAL_MS);
    expect(service.save).toHaveBeenLastCalledWith(fields('Hello there'), 1);
    expect(result.current.draft.status).toBe('saved');
  });

  it('starts a new draft from this device after one published elsewhere, if the writer keeps writing', async () => {
    writeLocalComposerDraft(7, { fields: fields('Unsent'), baseRevision: 3, synced: false });
    service.save.mockResolvedValue(ok(saved('Unsent', 1)));
    const { result } = renderDraft();
    await settle();

    act(() => result.current.draft.keepThisDraft());
    await settle();
    expect(service.save).toHaveBeenCalledWith(fields('Unsent'), null);
  });

  it('says where the draft is when the server cannot be reached to load, discard or check a clash', async () => {
    service.load.mockResolvedValueOnce({ status: 'failed' });
    const { result, unmount } = renderDraft();
    await settle();
    expect(result.current.draft.status).toBe('local');
    unmount();

    service.load.mockResolvedValueOnce(ok(saved('Old', 4))).mockResolvedValueOnce({ status: 'offline' });
    service.discard.mockResolvedValueOnce({ status: 'offline' }).mockResolvedValueOnce({ status: 'failed' });
    const second = renderDraft();
    await settle();
    act(() => second.result.current.draft.discardSavedDraft());
    await settle();
    expect(second.result.current.draft).toMatchObject({ status: 'offline', offer: { kind: 'restore' } });
    act(() => second.result.current.draft.discardSavedDraft());
    await settle();
    expect(second.result.current.draft.status).toBe('local');

    service.save.mockResolvedValueOnce({ status: 'conflict' });
    act(() => second.result.current.draft.keepThisDraft());
    await type(second.result, 'Mine');
    await wait(DRAFT_SAVE_DELAY_MS + DRAFT_MIN_SAVE_INTERVAL_MS);
    expect(second.result.current.draft).toMatchObject({ status: 'offline', offer: null });
  });

  it('forgets a copy whose draft the server no longer has, and publishes without a draft to discard', async () => {
    writeLocalComposerDraft(7, { fields: fields('Sent'), baseRevision: 2, synced: true });
    const { result } = renderDraft();
    await settle();

    expect(readLocalComposerDraft(7)).toBeNull();
    expect(result.current.fields.text).toBe('');
    act(() => result.current.draft.onPublished());
    expect(service.discard).not.toHaveBeenCalled();
    act(() => {
      result.current.draft.takeSavedDraft();
      result.current.draft.discardSavedDraft();
    });
    expect(result.current.fields.text).toBe('');
  });

  it('keeps nothing in this browser from a save that answers after the composer is gone', async () => {
    let answer: (outcome: DraftOutcome<ComposerDraft>) => void = () => undefined;
    service.save.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    const { result, unmount } = renderDraft();
    await settle();
    await type(result, 'Before signing out');
    localStorage.clear();
    await act(async () => { result.current.draft.flush(); });

    unmount();
    await act(async () => { answer(ok(saved('Before signing out', 2))); });

    expect(readLocalComposerDraft(7)).toBeNull();
    expect(service.discard).not.toHaveBeenCalled();
  });

  it('does nothing for a signed-out visitor', async () => {
    auth.user = null;
    const { result } = renderDraft();
    await settle();
    await type(result, 'Hello');
    await wait(DRAFT_SAVE_DELAY_MS);

    expect(service.load).not.toHaveBeenCalled();
    expect(service.save).not.toHaveBeenCalled();
  });
});
