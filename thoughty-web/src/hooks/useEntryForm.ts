import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Attachment, Config, Diary } from '../types';
import { getAutoTagLimit } from '../utils/autoTagLimit';
import { formatEntryDate } from '../utils/entryDate';
import { cleanEntryTitle } from '../utils/entryTime';
import { defaultTimeCapsule, isValidTimeCapsuleDate, type TimeCapsuleDraft } from '../utils/timeCapsule';
import { browserTimeZone } from '../utils/timeZone';
import { storePlacedFiles } from '../utils/inlineImages';
import { useApiServices } from './useApiServices';
import { useEntryTagSuggestions } from './useEntryTagSuggestions';
import type { SavedEntry } from '../components/ComfortReads/comfortReadsState';
import { useFeatureFlag } from '../components/FeatureFlags/featureFlags';
import { useComposerDraftSync } from '../components/ComposerDraft/useComposerDraftSync';
import type { ComposerDraftFields } from '../services/api/composerDraftService';
import { draftKey, isEmptyDraft } from '../components/ComposerDraft/composerDraftPlan';
import { diaryDefaultTemplate, getEntryTemplates, type EntryTemplate } from '../utils/entryTemplates';
import { useDiaryTemplatePrefill } from '../components/EntryForm/useDiaryTemplatePrefill';

const NO_DIARIES: readonly Diary[] = [];

export const useEntryForm = (
  config: Config,
  currentDiaryId: number | null,
  onSuccess: () => void,
  diaries: readonly Diary[] = NO_DIARIES,
) => {
  const { entriesService, attachmentsService, aiService } = useApiServices();

  const [newEntryText, setNewEntryText] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState<string>('');
  const [mood, setMood] = useState<number | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  /** Set when the entry is sealed as a time capsule. */
  const [timeCapsule, setTimeCapsule] = useState<TimeCapsuleDraft | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [chosenVisibility, setVisibility] = useState<'public' | 'private' | null>(null);
  // While public sharing is switched off, a new entry is saved private whatever the default or the choice
  const publicSharing = useFeatureFlag('publicSharing');
  const visibility = publicSharing ? chosenVisibility : 'private';
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain');
  /** A translation key, which the form shows with `t`. */
  const [formError, setFormError] = useState<string>('');
  const [fixingWriting, setFixingWriting] = useState<boolean>(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  /** The entry saved last, a new object for each save, which the journal's comfort reads offer follows. */
  const [savedEntry, setSavedEntry] = useState<SavedEntry | null>(null);
  // With AI switched off nothing adds tags, so an entry needs one of its own
  const autoTagLimit = useFeatureFlag('ai') ? getAutoTagLimit(config.autoTagMaxTags) : 0;
  const tagSuggestions = useEntryTagSuggestions(aiService, newEntryText, tags, setTags, autoTagLimit, setFormError);

  // The draft follows the writer to their other devices; the date, time, visibility, capsule and files stay here
  const applyDraft = useCallback((fields: ComposerDraftFields) => {
    setNewEntryText(fields.text);
    setTitle(fields.title ?? '');
    setTags(fields.tags);
    setFormat(fields.format);
    setMood(fields.mood);
    setFeelings(fields.feelings);
  }, []);
  const draftFields: ComposerDraftFields = { text: newEntryText, title: title === '' ? null : title, tags, format, mood, feelings };
  // The fields the diary's default template left in the composer, and how many entries were saved since it opened
  const [templateFill, setTemplateFill] = useState<{ name: string; fields: ComposerDraftFields } | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const untouchedTemplate = templateFill !== null && draftKey(templateFill.fields) === draftKey(draftFields);
  const draft = useComposerDraftSync(draftFields, applyDraft, untouchedTemplate);
  const { onPublished: onDraftPublished } = draft;

  const templates = useMemo(() => getEntryTemplates(config.entryTemplates), [config.entryTemplates]);
  const defaultTemplate = diaryDefaultTemplate(diaries, currentDiaryId, templates);
  const fillFromTemplate = useCallback((template: EntryTemplate | null) => {
    setNewEntryText(template?.content ?? '');
    setTags(template ? [...template.tags] : []);
    setFormat(template?.format ?? 'plain');
    setVisibility(template?.visibility ?? (config.defaultVisibility || 'private'));
    setTimeCapsule(template?.sealYears ? defaultTimeCapsule(new Date(), template.sealYears) : null);
    setTemplateFill(template && {
      name: template.name,
      fields: { text: template.content, title: null, tags: [...template.tags], format: template.format, mood, feelings },
    });
  }, [config.defaultVisibility, feelings, mood]);
  useDiaryTemplatePrefill({
    template: defaultTemplate,
    scope: `${currentDiaryId ?? 'all'}:${savedCount}`,
    enabled: draft.ready && draft.offer === null,
    empty: isEmptyDraft(draftFields),
    untouched: untouchedTemplate,
    fill: fillFromTemplate,
  });

  const resetEntryForm = useCallback(() => {
    setNewEntryText('');
    setTitle('');
    setTimeOfDay('');
    setMood(null);
    setFeelings([]);
    setTimeCapsule(null);
    setTags([]);
    setFormat('plain');
    setVisibility(config.defaultVisibility || 'private');
    setPendingFiles([]);
    setUploadedAttachments([]);
    setSavedCount((count) => count + 1);
  }, [config.defaultVisibility]);

  const validateEntryForm = useCallback(() => {
    if (!newEntryText.trim()) {
      return 'entryTextRequired';
    }
    if ((!tags || tags.length === 0) && autoTagLimit === 0) {
      return 'entryTagRequired';
    }
    if (timeCapsule && !isValidTimeCapsuleDate(timeCapsule.opensOn, new Date())) {
      return 'timeCapsuleDateRequired';
    }
    return '';
  }, [newEntryText, tags, autoTagLimit, timeCapsule]);

  useEffect(() => {
    if (config.defaultVisibility && chosenVisibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility, chosenVisibility]);

  const handleSubmit = useCallback(async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setFormError('');

    const validationError = validateEntryForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Pictures placed in the text are uploaded first, so the saved text names them by ID
    const placed = format === 'markdown'
      ? await storePlacedFiles(newEntryText, pendingFiles, (file) => attachmentsService.uploadAttachment(file))
      : { text: newEntryText, remaining: pendingFiles };
    const result = await entriesService.createEntry({
      text: placed.text,
      title: cleanEntryTitle(title),
      timeOfDay: timeOfDay || null,
      mood,
      feelings,
      tags,
      date: formatEntryDate(selectedDate),
      visibility,
      format,
      diaryId: currentDiaryId,
      seal: timeCapsule ? { ...timeCapsule, timeZone: browserTimeZone() } : null,
    });

    if (!result.success || !result.entryId) {
      setFormError(result.error || 'entrySaveFailed');
      return;
    }

    for (const file of placed.remaining) {
      await attachmentsService.uploadAttachment(file, result.entryId);
    }

    for (const attachment of uploadedAttachments) {
      if (!attachment.entry_id) {
        await attachmentsService.linkAttachment(attachment.id, result.entryId);
      }
    }

    setSavedEntry({ id: result.entryId, mood });
    onDraftPublished();
    resetEntryForm();
    onSuccess();
  }, [attachmentsService, currentDiaryId, entriesService, feelings, format, mood, newEntryText, onDraftPublished, onSuccess, pendingFiles, resetEntryForm, selectedDate, tags, timeCapsule, timeOfDay, title, uploadedAttachments, validateEntryForm, visibility]);

  const addPendingFile = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const removeUploadedAttachment = useCallback(async (attachmentId: number) => {
    await attachmentsService.deleteAttachment(attachmentId);
    setUploadedAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, [attachmentsService]);

  const handleFixWriting = useCallback(async () => {
    if (!newEntryText.trim()) {
      setFormError('fixWritingNeedsText');
      return false;
    }

    setFormError('');
    setFixingWriting(true);
    const corrected = await aiService.fixWriting(newEntryText);
    setFixingWriting(false);

    if (corrected === null) {
      setFormError('fixWritingFailed');
      return false;
    }
    if (corrected === newEntryText) {
      setFormError('fixWritingNoChanges');
      return false;
    }

    setNewEntryText(corrected);
    return true;
  }, [aiService, newEntryText]);

  return {
    newEntryText,
    setNewEntryText,
    title,
    setTitle,
    timeOfDay,
    setTimeOfDay,
    mood,
    setMood,
    feelings,
    setFeelings,
    timeCapsule,
    setTimeCapsule,
    tags,
    setTags,
    selectedDate,
    setSelectedDate,
    visibility,
    setVisibility,
    format,
    setFormat,
    formError,
    setFormError,
    ...tagSuggestions,
    fixingWriting,
    handleFixWriting,
    handleSubmit,
    savedEntry,
    pendingFiles,
    uploadedAttachments,
    addPendingFile,
    removePendingFile,
    removeUploadedAttachment,
    draft,
    /** The name of the diary template the composer holds untouched, which another start replaces without asking. */
    diaryTemplateName: untouchedTemplate ? templateFill.name : null,
  };
};
