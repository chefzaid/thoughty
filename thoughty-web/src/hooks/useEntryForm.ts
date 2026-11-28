import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Attachment, Config, Diary } from '../types';
import { getAutoTagLimit } from '../utils/autoTagLimit';
import { composerDiaryId, diaryAiMode, isDiaryAiModeRefusal } from '../utils/diaryAi';
import { confirmAiRequest, type AiRequestDiary, type RequestAiConsent } from '../components/DiaryAi/aiConsent';
import { textAiForDiary } from '../services/localModel/localAiService';
import { autoTagWithLocalModel } from '../services/localModel/localAutoTag';
import { recordingTranscriptions } from '../services/speech/recordingTranscriptions';
import { speechLanguage } from '../services/speech/speechProtocol';
import { formatEntryDate } from '../utils/entryDate';
import { cleanEntryTitle } from '../utils/entryTime';
import { defaultTimeCapsule, isValidTimeCapsuleDate, type TimeCapsuleDraft } from '../utils/timeCapsule';
import { browserTimeZone } from '../utils/timeZone';
import { storePlacedFiles } from '../utils/inlineImages';
import { useApiServices } from './useApiServices';
import { useEntryTagSuggestions } from './useEntryTagSuggestions';
import type { SavedEntry } from '../components/ComfortReads/comfortReadsState';
import { hasCrisisSignal } from '../utils/crisisSignals';
import { useFeatureFlag } from '../components/FeatureFlags/featureFlags';
import { useComposerDraftSync } from '../components/ComposerDraft/useComposerDraftSync';
import type { ComposerDraftFields } from '../services/api/composerDraftService';
import { draftKey, isEmptyDraft } from '../components/ComposerDraft/composerDraftPlan';
import { diaryDefaultTemplate, getEntryTemplates, type EntryTemplate } from '../utils/entryTemplates';
import { useDiaryTemplatePrefill } from '../components/EntryForm/useDiaryTemplatePrefill';
import { locationPayload, NO_LOCATION, type EntryLocationDraft } from '../utils/entryLocation';

const NO_DIARIES: readonly Diary[] = [];

/** What the composer held when the writer pressed Save. */
interface SavedComposer {
  readonly text: string;
  readonly title: string;
  readonly timeOfDay: string;
  readonly mood: number | null;
  readonly feelings: string[];
  readonly location: EntryLocationDraft;
  readonly timeCapsule: TimeCapsuleDraft | null;
  readonly tags: string[];
  readonly chosenVisibility: 'public' | 'private' | null;
  readonly pendingFiles: readonly File[];
  readonly uploadedAttachments: readonly Attachment[];
}

/** A state update that empties a field still holding what was saved, and keeps what was written since. */
const unlessChanged = <T,>(saved: T, empty: T) => (current: T): T => (current === saved ? empty : current);

export const useEntryForm = (
  config: Config,
  currentDiaryId: number | null,
  onSuccess: () => void,
  diaries: readonly Diary[] = NO_DIARIES,
  /** Hears that the server refused Rephrase or Auto Tag for the diary's AI mode, so the diaries load again. */
  onDiaryAiOff?: () => void,
  /** Shows what Rephrase or Auto Tag would send from a diary that asks each time, and resolves with the answer. */
  requestAiConsent?: RequestAiConsent,
) => {
  const { entriesService, attachmentsService, aiService, localAiService } = useApiServices();

  const [newEntryText, setNewEntryText] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState<string>('');
  const [mood, setMood] = useState<number | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  /** The place it was written, which stays on this device until saved, like the date and time. */
  const [location, setLocation] = useState<EntryLocationDraft>(NO_LOCATION);
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
  /** Set while an entry is being saved. */
  const saving = useRef(false);
  const latestText = useRef(newEntryText);
  latestText.current = newEntryText;
  // With AI switched off, or not on in the composer's diary (saving is no request the writer saw), nothing adds
  // tags, so an entry needs one of its own; in a diary on the writer's own model this browser adds them once the
  // entry is saved, when that model is set up here
  const aiDiaryId = composerDiaryId(diaries, currentDiaryId);
  const composerAiMode = diaryAiMode(diaries, aiDiaryId);
  const tagsOnSave = composerAiMode === 'on' || (composerAiMode === 'local' && localAiService.isConfigured());
  const aiFeature = useFeatureFlag('ai');
  const autoTagLimit = aiFeature && tagsOnSave ? getAutoTagLimit(config.autoTagMaxTags) : 0;
  const aiDiary = useMemo<AiRequestDiary>(
    () => ({ diaryId: aiDiaryId, mode: composerAiMode, requestConsent: requestAiConsent, onModeRefused: onDiaryAiOff }),
    [aiDiaryId, composerAiMode, onDiaryAiOff, requestAiConsent],
  );
  // Rephrase and Auto Tag go to the writer's own model in a diary set to it, else to Thoughty's server
  const textAi = useMemo(() => textAiForDiary(composerAiMode, aiService, localAiService), [aiService, composerAiMode, localAiService]);
  const tagSuggestions = useEntryTagSuggestions(textAi, newEntryText, tags, setTags, autoTagLimit, setFormError, aiDiary);

  // The draft follows the writer to their other devices; the date, time, place, visibility, capsule and files stay here
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

  const templates = useMemo(() => getEntryTemplates(config.entryTemplates, config.language), [config.entryTemplates, config.language]);
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

  /**
   * Empties the composer of the entry just saved. Each field the writer changed while it was being saved
   * keeps what they wrote, and files added meanwhile stay, so writing on right after Save loses nothing.
   */
  const clearSavedEntry = useCallback((saved: SavedComposer) => {
    setNewEntryText(unlessChanged(saved.text, ''));
    setTitle(unlessChanged(saved.title, ''));
    setTimeOfDay(unlessChanged(saved.timeOfDay, ''));
    setMood(unlessChanged(saved.mood, null));
    setFeelings(unlessChanged<string[]>(saved.feelings, []));
    setLocation(unlessChanged(saved.location, NO_LOCATION));
    setTimeCapsule(unlessChanged(saved.timeCapsule, null));
    setTags(unlessChanged<string[]>(saved.tags, []));
    // The format belongs to the text: text written during the save keeps it
    if (latestText.current === saved.text) setFormat('plain');
    setVisibility(unlessChanged(saved.chosenVisibility, config.defaultVisibility || 'private'));
    setPendingFiles((current) => current.filter((file) => !saved.pendingFiles.includes(file)));
    setUploadedAttachments((current) => current.filter((attachment) => !saved.uploadedAttachments.includes(attachment)));
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
    // Pressing Save again while the entry is being saved would save it twice
    if (saving.current) return;
    setFormError('');

    const validationError = validateEntryForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    saving.current = true;
    try {
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
        location: locationPayload(location),
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

      const stored: Attachment[] = [];
      for (const file of placed.remaining) {
        const attachment = await attachmentsService.uploadAttachment(file, result.entryId);
        if (attachment) stored.push(attachment);
      }

      for (const attachment of uploadedAttachments) {
        if (!attachment.entry_id) {
          await attachmentsService.linkAttachment(attachment.id, result.entryId);
        }
      }

      setSavedEntry({ id: result.entryId, mood, crisisSignal: hasCrisisSignal(title, newEntryText) });
      onDraftPublished();
      clearSavedEntry({ text: newEntryText, title, timeOfDay, mood, feelings, location, timeCapsule, tags, chosenVisibility, pendingFiles, uploadedAttachments });
      onSuccess();
      if (composerAiMode === 'local' && aiFeature) {
        // Its recordings are transcribed on this device, in the background, Thoughty keeping only the text
        recordingTranscriptions.transcribe({ attachments: [...stored, ...uploadedAttachments], attachmentsService, language: speechLanguage(config.language) });
      }
      if (composerAiMode === 'local' && autoTagLimit > 0) {
        // The writer's own model tags the saved entry from here, as the server does for the other diaries
        void autoTagWithLocalModel({
          localAi: localAiService,
          entriesService,
          entryId: result.entryId,
          text: placed.text,
          tags,
          limit: autoTagLimit,
        }).then((outcome) => {
          if (outcome === 'tagged') onSuccess();
          if (outcome === 'failed') setFormError('localModelAutoTagFailed');
        });
      }
    } finally {
      saving.current = false;
    }
  }, [aiFeature, attachmentsService, autoTagLimit, chosenVisibility, clearSavedEntry, composerAiMode, config.language, currentDiaryId, entriesService, feelings, format, localAiService, location, mood, newEntryText, onDraftPublished, onSuccess, pendingFiles, selectedDate, tags, timeCapsule, timeOfDay, title, uploadedAttachments, validateEntryForm, visibility]);

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
    const consent = await confirmAiRequest(composerAiMode, requestAiConsent, { text: newEntryText, task: 'writing' });
    if (!consent.send) return false;

    setFixingWriting(true);
    const { data: corrected, refusal } = await textAi.fixWriting(newEntryText, 'grammar', aiDiaryId, consent.aiConsent);
    setFixingWriting(false);

    if (corrected === null) {
      setFormError(refusal ?? 'fixWritingFailed');
      if (isDiaryAiModeRefusal(refusal)) onDiaryAiOff?.();
      return false;
    }
    if (corrected === newEntryText) {
      setFormError('fixWritingNoChanges');
      return false;
    }

    setNewEntryText(corrected);
    return true;
  }, [aiDiaryId, composerAiMode, newEntryText, onDiaryAiOff, requestAiConsent, textAi]);

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
    location,
    setLocation,
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
    /** The AI mode of the diary the composer writes into: no AI action with AI off, each one asks first with `ask`. */
    diaryAiMode: composerAiMode,
    /** The name of the diary template the composer holds untouched, which another start replaces without asking. */
    diaryTemplateName: untouchedTemplate ? templateFill.name : null,
  };
};
