import { useState, useCallback } from 'react';
import type { Attachment, Config, Diary, Entry } from '../types';
import { getAutoTagLimit } from '../utils/autoTagLimit';
import { formatEntryDate } from '../utils/entryDate';
import { cleanEntryTitle } from '../utils/entryTime';
import { useApiServices } from './useApiServices';
import { storePlacedFiles } from '../utils/inlineImages';
import type { Notifier } from './useAppNotice';
import type { MoveToDiary } from './useMoveToDiary';
import { useFeatureFlag } from '../components/FeatureFlags/featureFlags';
import { useLeaveWarning } from '../components/ComposerDraft/useLeaveWarning';
import { autoTagWithLocalModel } from '../services/localModel/localAutoTag';
import { diaryAiMode } from '../utils/diaryAi';
import { recordingTranscriptions } from '../services/speech/recordingTranscriptions';
import { speechLanguage } from '../services/speech/speechProtocol';

const NO_DIARIES: readonly Pick<Diary, 'id' | 'aiMode'>[] = [];

/**
 * The entry editor's state and save. `moveToDiary` moves the entry when the editor chose another diary for it,
 * after its changes are saved, through the same move as the entry's **Move to diary** (it says where it went).
 * An entry of a diary on the writer's own model (among `diaries`) is tagged by that model from this browser once
 * saved, as the server tags the others on save, and the recordings added to it are transcribed on this device.
 */
export const useEntryEdit = (
  config: Config,
  onSave: () => void,
  { notify, t }: Notifier,
  moveToDiary?: MoveToDiary,
  diaries: readonly Pick<Diary, 'id' | 'aiMode'>[] = NO_DIARIES,
) => {
  const { entriesService, attachmentsService, localAiService } = useApiServices();
  // With AI switched off nothing adds tags on save, so an edited entry needs one of its own
  const aiFeature = useFeatureFlag('ai');
  const autoTagLimit = aiFeature ? getAutoTagLimit(config.autoTagMaxTags) : 0;

  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editTimeOfDay, setEditTimeOfDay] = useState<string>('');
  const [editMood, setEditMood] = useState<number | null>(null);
  const [editFeelings, setEditFeelings] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');
  const [editFormat, setEditFormat] = useState<'plain' | 'markdown'>('plain');
  const [editDiaryId, setEditDiaryId] = useState<number | null>(null);
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editExistingAttachments, setEditExistingAttachments] = useState<Attachment[]>([]);

  // Closing the page with unsaved changes to the entry asks first; the editor itself keeps them while the app is open
  useLeaveWarning(() => editingEntry !== null
    && (editText !== editingEntry.content || editTitle !== (editingEntry.title ?? '')));

  const handleEdit = useCallback((entry: Entry) => {
    setEditingEntry(entry);
    setEditText(entry.content);
    setEditTitle(entry.title ?? '');
    setEditTimeOfDay(entry.time_of_day ?? '');
    setEditMood(entry.mood ?? null);
    setEditFeelings(entry.feelings ?? []);
    setEditTags(entry.tags || []);
    setEditVisibility(entry.visibility || 'private');
    setEditFormat(entry.format || 'plain');
    setEditDiaryId(entry.diary_id ?? null);
    setEditPendingFiles([]);
    setEditExistingAttachments(entry.attachments || []);
    let dateStr = entry.date;
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0] ?? dateStr;
    }
    const [year = new Date().getFullYear(), month = 1, day = 1] = dateStr.split('-').map(Number);
    setEditDate(new Date(year, month - 1, day));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    setEditText('');
    setEditTitle('');
    setEditTimeOfDay('');
    setEditMood(null);
    setEditFeelings([]);
    setEditTags([]);
    setEditDate(null);
    setEditVisibility('private');
    setEditFormat('plain');
    setEditDiaryId(null);
    setEditPendingFiles([]);
    setEditExistingAttachments([]);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editText.trim() || (editTags.length === 0 && autoTagLimit === 0)) {
      notify(t('entryEditRequired'));
      return;
    }
    if (!editDate || !editingEntry) {
      return;
    }

    // Pictures placed in the text are uploaded first, so the saved text names them by ID
    const entryId = editingEntry.id;
    const placed = editFormat === 'markdown'
      ? await storePlacedFiles(editText, editPendingFiles, (file) => attachmentsService.uploadAttachment(file, entryId))
      : { text: editText, remaining: editPendingFiles };
    const success = await entriesService.updateEntry(entryId, {
      text: placed.text,
      title: cleanEntryTitle(editTitle),
      timeOfDay: editTimeOfDay || null,
      mood: editMood,
      feelings: editFeelings,
      tags: editTags,
      date: formatEntryDate(editDate),
      visibility: editVisibility,
      format: editFormat,
    });

    if (!success) {
      notify(t('entryUpdateFailed'));
      return;
    }
    if (autoTagLimit > 0 && diaryAiMode(diaries, editingEntry.diary_id) === 'local') {
      void autoTagWithLocalModel({ localAi: localAiService, entriesService, entryId, text: placed.text, tags: editTags, limit: autoTagLimit })
        .then((outcome) => {
          if (outcome === 'tagged') onSave();
          if (outcome === 'failed') notify(t('localModelAutoTagFailed'));
        });
    }

    const added: Attachment[] = [];
    for (const file of placed.remaining) {
      const attachment = await attachmentsService.uploadAttachment(file, editingEntry.id);
      if (attachment) added.push(attachment);
    }

    const originalIds = new Set((editingEntry.attachments || []).map((attachment) => attachment.id));
    const remainingIds = new Set(editExistingAttachments.map((attachment) => attachment.id));
    for (const attachmentId of originalIds) {
      if (!remainingIds.has(attachmentId)) {
        await attachmentsService.deleteAttachment(attachmentId);
      }
    }

    // The changes are saved whatever happens to the move, which says itself where the entry went
    let diaryId = editingEntry.diary_id ?? null;
    if (moveToDiary && editDiaryId !== null && editDiaryId !== diaryId) {
      const moved = await moveToDiary(entryId, editDiaryId);
      if (moved) {
        diaryId = editDiaryId;
      } else {
        notify(t('entrySavedNotMoved'));
      }
    }
    // The recordings added to an entry of a diary on the writer's own model are transcribed on this device
    if (aiFeature && diaryAiMode(diaries, diaryId) === 'local') {
      recordingTranscriptions.transcribe({ attachments: added, attachmentsService, language: speechLanguage(config.language) });
    }

    handleCancelEdit();
    onSave();
  }, [aiFeature, attachmentsService, autoTagLimit, config.language, diaries, editDate, editDiaryId, editExistingAttachments, editFeelings, editFormat, editMood, editPendingFiles, editTags, editText, editTimeOfDay, editTitle, editVisibility, editingEntry, entriesService, handleCancelEdit, localAiService, moveToDiary, notify, onSave, t]);

  const addEditPendingFile = useCallback((file: File) => {
    setEditPendingFiles((prev) => [...prev, file]);
  }, []);

  const removeEditPendingFile = useCallback((index: number) => {
    setEditPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const removeEditAttachment = useCallback(async (attachmentId: number) => {
    setEditExistingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  return {
    editingEntry,
    editText,
    setEditText,
    editTitle,
    setEditTitle,
    editTimeOfDay,
    setEditTimeOfDay,
    editMood,
    setEditMood,
    editFeelings,
    setEditFeelings,
    editTags,
    setEditTags,
    editDate,
    setEditDate,
    editVisibility,
    setEditVisibility,
    editFormat,
    setEditFormat,
    editDiaryId,
    setEditDiaryId,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    editPendingFiles,
    editExistingAttachments,
    addEditPendingFile,
    removeEditPendingFile,
    removeEditAttachment,
  };
};
