import { useState, useEffect, useCallback } from 'react';
import type { Attachment, Config } from '../types';
import { getAutoTagLimit } from '../utils/autoTagLimit';
import { formatEntryDate } from '../utils/entryDate';
import { cleanEntryTitle } from '../utils/entryTime';
import { browserTimeZone, isValidTimeCapsuleDate, type TimeCapsuleDraft } from '../utils/timeCapsule';
import { useApiServices } from './useApiServices';
import { useEntryTagSuggestions } from './useEntryTagSuggestions';

export const useEntryForm = (
  config: Config,
  currentDiaryId: number | null,
  onSuccess: () => void,
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
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null);
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain');
  /** A translation key, which the form shows with `t`. */
  const [formError, setFormError] = useState<string>('');
  const [fixingWriting, setFixingWriting] = useState<boolean>(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const autoTagLimit = getAutoTagLimit(config.autoTagMaxTags);
  const tagSuggestions = useEntryTagSuggestions(aiService, newEntryText, tags, setTags, autoTagLimit, setFormError);

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
    if (config.defaultVisibility && visibility === null) {
      setVisibility(config.defaultVisibility);
    }
  }, [config.defaultVisibility, visibility]);

  const handleSubmit = useCallback(async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setFormError('');

    const validationError = validateEntryForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const result = await entriesService.createEntry({
      text: newEntryText,
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

    const allAttachmentIds = uploadedAttachments.map((attachment) => attachment.id);
    for (const file of pendingFiles) {
      const uploaded = await attachmentsService.uploadAttachment(file, result.entryId);
      if (uploaded) {
        allAttachmentIds.push(uploaded.id);
      }
    }

    for (const attachment of uploadedAttachments) {
      if (!attachment.entry_id) {
        await attachmentsService.linkAttachment(attachment.id, result.entryId);
      }
    }

    resetEntryForm();
    onSuccess();
  }, [attachmentsService, currentDiaryId, entriesService, feelings, format, mood, newEntryText, onSuccess, pendingFiles, resetEntryForm, selectedDate, tags, timeCapsule, timeOfDay, title, uploadedAttachments, validateEntryForm, visibility]);

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
    pendingFiles,
    uploadedAttachments,
    addPendingFile,
    removePendingFile,
    removeUploadedAttachment,
  };
};
