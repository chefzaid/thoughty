import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';

import { getTranslation, type Language } from '../utils/translations';
import { renderHook } from './hookTestUtils';
import type { NoticeAction, Notifier } from './useAppNotice';
import { useDeleteUndo } from './useDeleteUndo';

const restore = vi.hoisted(() => vi.fn());

vi.mock('./useAuthenticatedService', () => ({ useAuthenticatedService: () => ({ restore }) }));

const createNotifier = (language: Language) => ({
  notify: vi.fn<Notifier['notify']>(),
  t: (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params),
  language,
});

const restored = (restoredCount: number) => ({ data: { success: true, restoredCount, movedToDefaultCount: 0 }, error: null });

/** Offers the undo for `entryIds` and returns the action the notice shows. */
function offer(entryIds: number[], notifier: ReturnType<typeof createNotifier>, onRestored = vi.fn()) {
  const { result } = renderHook(() => useDeleteUndo(onRestored, notifier));
  act(() => result.current(entryIds));
  return notifier.notify.mock.calls.at(-1)?.[1] as NoticeAction;
}

describe.each([
  { language: 'en' as const, one: 'Entry moved to the recycle bin', three: '3 entries moved to the recycle bin', undo: 'Undo', back: '3 entries back in your journal.', gone: 'These entries are no longer in the recycle bin.' },
  { language: 'fr' as const, one: 'Entrée placée dans la corbeille', three: '3 entrées placées dans la corbeille', undo: 'Annuler', back: '3 entrées de retour dans votre journal.', gone: 'Ces entrées ne sont plus dans la corbeille.' },
])('useDeleteUndo in $language', (expected) => {
  let notifier: ReturnType<typeof createNotifier>;

  beforeEach(() => {
    restore.mockReset();
    notifier = createNotifier(expected.language);
  });

  it('says the entries are in the recycle bin, with an Undo, counting them for a bulk delete', () => {
    const single = offer([4], notifier);
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.one, single);
    expect(single.label).toBe(expected.undo);

    offer([4, 5, 6], notifier);
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.three, expect.objectContaining({ label: expected.undo }));
    expect(restore).not.toHaveBeenCalled();
  });

  it('puts exactly the deleted entries back in place, then refreshes the journal and says so', async () => {
    restore.mockResolvedValue(restored(3));
    const onRestored = vi.fn();
    const action = offer([9, 3, 7], notifier, onRestored);

    await act(async () => action.run());

    expect(restore).toHaveBeenCalledWith([9, 3, 7], { inPlace: true });
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.back);
  });

  it('shows the coded API error when the entries can no longer be restored', async () => {
    restore.mockResolvedValue({ data: null, error: 'apiError_RECYCLE_BIN_ENTRIES_NOT_FOUND' });
    const onRestored = vi.fn();
    const action = offer([4], notifier, onRestored);

    await act(async () => action.run());

    expect(onRestored).not.toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.gone);
  });
});

describe('useDeleteUndo with many entries', () => {
  beforeEach(() => restore.mockReset());

  it('restores a hundred entries per request, in order, and stops at the first failure', async () => {
    const notifier = createNotifier('en');
    const ids = Array.from({ length: 250 }, (_, index) => index + 1);
    restore
      .mockResolvedValueOnce(restored(100))
      .mockResolvedValueOnce({ data: null, error: 'Failed to restore entries' });
    const onRestored = vi.fn();
    const action = offer(ids, notifier, onRestored);

    await act(async () => action.run());

    expect(restore.mock.calls.map(([chunk]) => [chunk[0], chunk.length])).toEqual([[1, 100], [101, 100]]);
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(notifier.notify).toHaveBeenLastCalledWith('Failed to restore entries');
  });

  it('offers nothing when no entry was deleted', () => {
    const notifier = createNotifier('en');
    offer([], notifier);
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
