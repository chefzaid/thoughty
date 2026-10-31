import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { Entry } from '../types';
import { getTranslation, type Language } from '../utils/translations';
import { useAppNotice, type Notifier } from './useAppNotice';
import { useBulkSelect } from './useBulkSelect';
import { useDeleteModal } from './useDeleteModal';
import { useEntryEdit } from './useEntryEdit';

const services = vi.hoisted(() => ({
  entriesService: { updateEntry: vi.fn(), deleteEntry: vi.fn(), bulkOperation: vi.fn() },
  attachmentsService: { uploadAttachment: vi.fn(), deleteAttachment: vi.fn() },
  aiService: { fixWriting: vi.fn() },
}));

vi.mock('./useApiServices', () => ({ useApiServices: () => services }));

const createNotifier = (language: Language): Notifier => ({
  notify: vi.fn(),
  t: (key, params) => getTranslation(language, key, params),
  language,
});

const entry = (id: number, content: string): Entry => ({
  id,
  content,
  tags: ['focus'],
  date: '2024-01-15',
  visibility: 'private',
} as Entry);

describe('useAppNotice', () => {
  it('shows each message in the toast and restarts it when shown again', () => {
    const t = (key: string) => key;
    const { result } = renderHook(() => useAppNotice(t, 'fr'));

    expect(result.current.toast.visible).toBe(false);
    expect(result.current.notifier).toMatchObject({ t, language: 'fr' });

    act(() => result.current.notifier.notify('Premier message'));
    expect(result.current.text).toBe('Premier message');
    expect(result.current.toast).toMatchObject({ visible: true, showCount: 1 });

    act(() => result.current.notifier.notify('Second message'));
    expect(result.current.text).toBe('Second message');
    expect(result.current.toast.showCount).toBe(2);

    act(() => result.current.toast.hide());
    expect(result.current.toast.visible).toBe(false);
  });

  it('shows a message with its action, and drops the action with the next plain message', () => {
    const { result } = renderHook(() => useAppNotice((key: string) => key, 'en'));
    const action = { label: 'Undo', run: vi.fn() };

    act(() => result.current.notifier.notify('Entry moved to the recycle bin', action));
    expect(result.current).toMatchObject({ text: 'Entry moved to the recycle bin', action });

    act(() => result.current.notifier.notify('Failed to delete entry.'));
    expect(result.current.action).toBeNull();
  });
});

describe.each([
  {
    language: 'en' as const,
    editRequired: 'Text and at least one tag are required',
    updateFailed: 'Failed to update entry.',
    deleteFailed: 'Failed to delete entry.',
    bulkFailed: 'Bulk operation failed.',
    noEntries: 'No selected entries are available to rephrase.',
    nothingToChange: 'No selected entries needed rephrasing.',
    rephraseFailed: 'Bulk rephrase failed.',
    summary: 'Bulk rephrase completed: 1 updated, 1 unchanged, 2 failed.',
    summaryNoFailures: 'Bulk rephrase completed: 2 updated, 1 unchanged, 0 failed.',
  },
  {
    language: 'fr' as const,
    editRequired: 'Le texte et au moins un tag sont requis',
    updateFailed: 'Impossible de mettre à jour l’entrée.',
    deleteFailed: 'Impossible de supprimer l’entrée.',
    bulkFailed: 'L’opération groupée a échoué.',
    noEntries: 'Aucune des entrées sélectionnées ne peut être reformulée.',
    nothingToChange: 'Aucune des entrées sélectionnées n’avait besoin d’être reformulée.',
    rephraseFailed: 'La reformulation groupée a échoué.',
    summary: 'Reformulation groupée terminée : 1 mise à jour, 1 inchangée, 2 en échec.',
    summaryNoFailures: 'Reformulation groupée terminée : 2 mises à jour, 1 inchangée, 0 en échec.',
  },
])('entry action notices in $language', (expected) => {
  let notifier: Notifier;

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = createNotifier(expected.language);
  });

  it('asks for text and a tag before saving an edit, and reports a failed update', async () => {
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '0' }, vi.fn(), notifier));

    act(() => result.current.handleEdit(entry(1, 'Draft')));
    act(() => result.current.setEditText('  '));
    await act(() => result.current.handleSaveEdit());
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.editRequired);

    services.entriesService.updateEntry.mockResolvedValueOnce(false);
    act(() => result.current.setEditText('Draft again'));
    await act(() => result.current.handleSaveEdit());
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.updateFailed);
  });

  it('reports a failed delete', async () => {
    services.entriesService.deleteEntry.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useDeleteModal(vi.fn(), notifier));

    act(() => result.current.handleDelete(3));
    await act(() => result.current.confirmDelete());

    expect(notifier.notify).toHaveBeenCalledWith(expected.deleteFailed);
  });

  it('reports a failed bulk operation', async () => {
    services.entriesService.bulkOperation.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useBulkSelect(vi.fn(), [], notifier));

    act(() => result.current.toggleSelect(1));
    await act(() => result.current.executeBulkAction('archive', { isArchived: true }));

    expect(notifier.notify).toHaveBeenCalledWith(expected.bulkFailed);
  });

  it('says when no selected entry can be rephrased', async () => {
    const { result } = renderHook(() => useBulkSelect(vi.fn(), [], notifier));

    act(() => result.current.toggleSelect(9));
    await act(() => result.current.executeBulkAction('rephrase'));

    expect(notifier.notify).toHaveBeenCalledWith(expected.noEntries);
  });

  it('says when the selected entries needed no rephrasing, or when every rephrase failed', async () => {
    const entries = [entry(1, 'Same')];
    const { result } = renderHook(() => useBulkSelect(vi.fn(), entries, notifier));

    services.aiService.fixWriting.mockResolvedValueOnce('Same');
    act(() => result.current.toggleSelect(1));
    await act(() => result.current.executeBulkAction('rephrase'));
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.nothingToChange);

    services.aiService.fixWriting.mockResolvedValueOnce(null);
    await act(() => result.current.executeBulkAction('rephrase'));
    expect(notifier.notify).toHaveBeenLastCalledWith(expected.rephraseFailed);
  });

  it('sums up a partly done bulk rephrase with each count in its plural form', async () => {
    const entries = [entry(1, 'One'), entry(2, 'Two'), entry(3, 'Three'), entry(4, '   ')];
    const onComplete = vi.fn();
    services.aiService.fixWriting.mockImplementation(async (content: string) => {
      if (content === 'One') return 'One, rephrased';
      if (content === 'Two') return 'Two';
      return null;
    });
    services.entriesService.updateEntry.mockResolvedValue(true);
    const { result } = renderHook(() => useBulkSelect(onComplete, entries, notifier));

    act(() => result.current.selectAll([1, 2, 3, 4]));
    await act(() => result.current.executeBulkAction('rephrase', { mode: 'polish' }));

    expect(onComplete).toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(expected.summary);
  });

  it('writes a zero count in its plural form', async () => {
    const entries = [entry(1, 'One'), entry(2, 'Two'), entry(3, 'Three')];
    services.aiService.fixWriting.mockImplementation(async (content: string) => (
      content === 'Three' ? content : `${content}, rephrased`
    ));
    services.entriesService.updateEntry.mockResolvedValue(true);
    const { result } = renderHook(() => useBulkSelect(vi.fn(), entries, notifier));

    act(() => result.current.selectAll([1, 2, 3]));
    await act(() => result.current.executeBulkAction('rephrase'));

    expect(notifier.notify).toHaveBeenCalledWith(expected.summaryNoFailures);
  });
});
