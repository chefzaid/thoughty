import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComposerDraftFields, DraftOutcome } from '../../services/api/composerDraftService';
import { EMPTY_DRAFT_FIELDS } from './composerDraftPlan';
import { readLocalComposerDraft } from './composerDraftStorage';
import { DRAFT_SAVE_DELAY_MS, useComposerDraftSync } from './useComposerDraftSync';

const service = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), discard: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const ok = <T,>(data: T): DraftOutcome<T> => ({ status: 'ok', data });
const TEMPLATE: ComposerDraftFields = { ...EMPTY_DRAFT_FIELDS, text: 'Today I am grateful for:', tags: ['gratitude'] };

/** A composer holding a diary's template, untouched until the writer types. */
function renderTemplateComposer() {
  return renderHook(() => {
    const [current, setCurrent] = useState(TEMPLATE);
    const untouched = current.text === TEMPLATE.text;
    return { setFields: setCurrent, draft: useComposerDraftSync(current, setCurrent, untouched) };
  });
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const leave = () => {
  const event = new Event('beforeunload', { cancelable: true });
  globalThis.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useComposerDraftSync with a diary template', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    service.load.mockReset().mockResolvedValue(ok(null));
    service.save.mockReset().mockResolvedValue(ok({ ...TEMPLATE, text: 'Today I am grateful for: rain', revision: 1, updatedAt: '2026-11-15T09:30:00.000Z' }));
    service.discard.mockReset().mockResolvedValue(ok(null));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps an untouched template off the server and this device, without a warning on leaving', async () => {
    const { result } = renderTemplateComposer();
    await settle();
    expect(result.current.draft.ready).toBe(true);

    await act(async () => { result.current.draft.flush(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS); });
    expect(service.save).not.toHaveBeenCalled();
    expect(readLocalComposerDraft(7)).toBeNull();
    expect(leave()).toBe(false);
  });

  it('saves the draft once the writer adds to the template', async () => {
    const { result } = renderTemplateComposer();
    await settle();

    act(() => result.current.setFields((previous) => ({ ...previous, text: 'Today I am grateful for: rain' })));
    await settle();
    expect(readLocalComposerDraft(7)?.fields.text).toBe('Today I am grateful for: rain');
    expect(leave()).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(DRAFT_SAVE_DELAY_MS); });
    expect(service.save).toHaveBeenCalledWith(expect.objectContaining({ text: 'Today I am grateful for: rain' }), null);
  });
});
