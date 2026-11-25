import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from './hookTestUtils';
import { useEntryEdit, useEntryForm } from './useEntryActions';
import { createEntriesServiceMock, notifier } from './useEntryActions.test-helpers';
import { makeDiary } from '../test/diaryFixture';

vi.mock('../contexts/AuthContext', async () => {
  const { authContextMock } = await import('./useEntryActions.test-helpers');
  const { useAuth } = authContextMock();
  return { useAuth: () => ({ ...useAuth(), user: { id: 7 } }) };
});
vi.mock('../services/api', async () => (await import('./useEntryActions.test-helpers')).apiModuleMock());
const transcribe = vi.hoisted(() => vi.fn());
vi.mock('../services/speech/recordingTranscriptions', () => ({ recordingTranscriptions: { transcribe } }));

const diaries = [makeDiary({ id: 1, name: 'Daily', aiMode: 'on' }), makeDiary({ id: 2, name: 'Letters', aiMode: 'local' })];
const voice = new File(['voice'], 'lake.webm', { type: 'audio/webm' });
const stored = { id: 77, original_filename: 'lake.webm', stored_filename: 'stored-lake.webm', mimetype: 'audio/webm', size: 5 };

let attachments: { uploadAttachment: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  vi.clearAllMocks();
  const { mockAuthFetch } = await import('./useEntryActions.test-helpers');
  mockAuthFetch.mockImplementation(async () => new Response(JSON.stringify({ draft: null }), { status: 200 }));
  const { createAttachmentsService } = await import('../services/api');
  attachments = { uploadAttachment: vi.fn().mockResolvedValueOnce(stored).mockResolvedValue(null) };
  vi.mocked(createAttachmentsService).mockReturnValue({ ...attachments, linkAttachment: vi.fn(), deleteAttachment: vi.fn() } as unknown as ReturnType<typeof createAttachmentsService>);
});

describe('recordings saved in a diary on the writer’s own model', () => {
  it('are transcribed on this device once the composer saves them, in the app’s language', async () => {
    await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 31 }) });
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private', language: 'fr' }, 2, vi.fn(), diaries));
    act(() => {
      result.current.setNewEntryText('A message for my sister');
      result.current.setTags(['family']);
      result.current.addPendingFile(voice);
      result.current.addPendingFile(new File(['x'], 'lost.webm', { type: 'audio/webm' }));
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(attachments.uploadAttachment).toHaveBeenCalledWith(voice, 31);
    expect(transcribe).toHaveBeenCalledWith({ attachments: [stored], attachmentsService: expect.anything(), language: 'fr' });
  });

  it('are left to Thoughty in a diary with AI on', async () => {
    await createEntriesServiceMock({ createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 31 }) });
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'private' }, 1, vi.fn(), diaries));
    act(() => {
      result.current.setNewEntryText('A note');
      result.current.setTags(['note']);
      result.current.addPendingFile(voice);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(transcribe).not.toHaveBeenCalled();
  });

  it('are transcribed once the editor adds them to an entry that is, or moves, there', async () => {
    await createEntriesServiceMock({ updateEntry: vi.fn().mockResolvedValue(true) });
    const moveToDiary = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderHook(() => useEntryEdit({}, vi.fn(), notifier, moveToDiary, diaries));
    const edit = async (diaryId: number) => {
      act(() => result.current.handleEdit({ id: 5, content: 'Entry', tags: ['lake'], date: '2026-11-20', visibility: 'private', diary_id: 1, index: 1 }));
      act(() => {
        result.current.setEditDiaryId(diaryId);
        result.current.addEditPendingFile(voice);
      });
      await act(async () => {
        await result.current.handleSaveEdit();
      });
    };

    await edit(2);
    expect(transcribe).toHaveBeenCalledWith({ attachments: [stored], attachmentsService: expect.anything(), language: 'en' });

    // A move refused leaves the entry in its diary with AI on
    transcribe.mockClear();
    await edit(2);
    expect(transcribe).not.toHaveBeenCalled();
  });
});
