import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import type { AnswerMemoirRequest, LifeEra } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { EMPTY_CAPTIONS_TRACK_URL } from '../../utils/attachments';
import type { Language } from '../../utils/translations';
import MemoirEraField from './MemoirEraField';
import MemoirFollowUps from './MemoirFollowUps';
import { useRecordingUpload } from './useRecordingUpload';
import { formatRecordingTime, isVoiceRecordingSupported, useVoiceRecorder } from './useVoiceRecorder';
import './MemoirAnswerForm.css';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';
import { confirmAiRequest } from '../DiaryAi/aiConsent';
import { useRequestAiConsent } from '../DiaryAi/aiConsentContext';
import { diaryOffersAi, type DiaryAiMode } from '../../utils/diaryAi';
import { useLocalAiService } from '../../hooks/useLocalAiService';
import type { AiAnswer } from '../../services/api/aiTypes';

const MAX_RECORDING_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AUDIO = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm';

const PROBLEM_MESSAGES = {
  empty: 'memoirAnswerEmpty',
  tooLarge: 'memoirRecordingTooLarge',
  upload: 'memoirUploadError',
  transcribe: 'memoirTranscribeError',
  save: 'memoirAnswerError',
} as const;

/** What the form says went wrong: one of its own messages, or why the writer's own model gave no text. */
type FormProblem = (typeof PROBLEM_MESSAGES)[keyof typeof PROBLEM_MESSAGES] | NonNullable<AiAnswer<never>['refusal']> | null;

/** A recording's text, or what the form says instead; null when the writer cancelled. */
type Transcription = { readonly text: string } | { readonly problem: NonNullable<FormProblem> } | null;

interface MemoirAnswerFormProps {
  readonly questionId: string;
  readonly questionText: string;
  readonly onSubmit: (request: AnswerMemoirRequest) => Promise<boolean>;
  readonly onCancel: () => void;
  /** The writer's life eras, to place the memory in one. */
  readonly eras?: readonly LifeEra[];
  /** The day the answer will be dated (`YYYY-MM-DD`). */
  readonly answerDate?: string;
  readonly language?: Language;
  /**
   * The memoir diary's AI mode: with AI off, no transcription and no follow-up questions; asking each time, each
   * shows the writer what it sends first.
   */
  readonly aiMode?: DiaryAiMode;
  /** The memoir diary, which a transcription names so the server can refuse it when that diary has AI off. */
  readonly diaryId?: number | null;
  readonly t: TranslationFunction;
}

function MemoirAnswerForm({ questionId, questionText, onSubmit, onCancel, eras = [], answerDate = '', language = 'en', aiMode = 'on', diaryId = null, t }: MemoirAnswerFormProps) {
  const { upload, attachmentsService } = useRecordingUpload();
  const localAiService = useLocalAiService();
  const recorder = useVoiceRecorder();
  const [text, setText] = useState('');
  const [eraId, setEraId] = useState<number | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [busy, setBusy] = useState<'transcribing' | 'saving' | null>(null);
  // Transcribing a recording and the follow-up questions are AI, left out while AI is switched off or off in the
  // memoir diary; on the writer's own model both go there
  const aiFeature = useFeatureFlag('ai');
  const followUpsOn = aiFeature && diaryOffersAi(aiMode, 'prompt');
  const transcriptionOn = aiFeature && diaryOffersAi(aiMode, 'transcription');
  const requestConsent = useRequestAiConsent();
  const fileInput = useRef<HTMLInputElement>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);
  const fieldId = `memoir-answer-${questionId}`;
  const recordingAvailable = isVoiceRecordingSupported() && recorder.status !== 'unavailable';

  const uploadRecording = async (): Promise<number | null> => (recorder.recording ? upload(recorder.recording.file) : null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_RECORDING_BYTES) {
      setProblem(PROBLEM_MESSAGES.tooLarge);
      return;
    }
    setProblem(null);
    recorder.setRecording({ file, url: URL.createObjectURL(file), seconds: null });
  };

  /** The recording's text from Thoughty's provider: asked first in a diary that asks each time, then uploaded. */
  const transcribeOnServer = async (recording: { file: File; seconds: number | null }): Promise<Transcription> => {
    // Asked before the upload, so a recording the writer keeps from the AI is not uploaded for it either
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      task: 'transcription',
      recording: { name: recording.file.name, seconds: recording.seconds },
    });
    if (!consent.send) return null;
    const attachmentId = await uploadRecording();
    if (!attachmentId) return { problem: PROBLEM_MESSAGES.upload };
    const transcription = await attachmentsService.transcribeAttachment(attachmentId, diaryId, consent.aiConsent);
    return transcription?.transcript ? { text: transcription.transcript } : { problem: PROBLEM_MESSAGES.transcribe };
  };

  /** The recording's text from the writer's own model, sent there from this page; nothing is uploaded for it. */
  const transcribeOnOwnModel = async (file: File): Promise<Transcription> => {
    const { data, refusal } = await localAiService.transcribe(file, file.name);
    return data === null ? { problem: refusal ?? PROBLEM_MESSAGES.transcribe } : { text: data };
  };

  const handleTranscribe = async () => {
    const recording = recorder.recording;
    if (!recording) return;
    setBusy('transcribing');
    setProblem(null);
    const result = aiMode === 'local' ? await transcribeOnOwnModel(recording.file) : await transcribeOnServer(recording);
    setBusy(null);
    if (!result) return;
    if ('problem' in result) {
      setProblem(result.problem);
      return;
    }
    setText((current) => (current.trim() ? `${current.trim()}\n\n${result.text}` : result.text));
  };

  // A follow-up goes at the end of the answer, in bold, with the caret below it to answer it
  const addFollowUp = (question: string) => {
    const next = `${text.trimEnd()}\n\n**${question}**\n\n`;
    setText(next);
    requestAnimationFrame(() => {
      const field = answerField.current;
      field?.focus();
      field?.setSelectionRange(next.length, next.length);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || recorder.status === 'recording') return;
    if (!text.trim() && !recorder.recording) {
      setProblem(PROBLEM_MESSAGES.empty);
      return;
    }
    setBusy('saving');
    setProblem(null);
    const attachmentId = recorder.recording ? await uploadRecording() : null;
    if (recorder.recording && !attachmentId) {
      setBusy(null);
      setProblem(PROBLEM_MESSAGES.upload);
      return;
    }
    const saved = await onSubmit({
      questionId,
      text: text.trim(),
      ...(attachmentId ? { attachmentIds: [attachmentId] } : {}),
      ...(eraId ? { eraId } : {}),
    });
    setBusy(null);
    if (!saved) setProblem(PROBLEM_MESSAGES.save);
  };

  return (
    <form className="memoir-answer-form" aria-label={questionText} onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor={fieldId} className="memoir-answer-label">{t('memoirYourAnswer')}</label>
      <textarea
        ref={answerField}
        id={fieldId}
        className="privacy-text"
        value={text}
        rows={7}
        maxLength={45000}
        placeholder={t('memoirAnswerPlaceholder')}
        aria-describedby={`${fieldId}-note`}
        onChange={(event) => setText(event.target.value)}
      />
      <p id={`${fieldId}-note`} className="memoir-hint">{t('memoirPrivateNote')}</p>
      {followUpsOn && (
        <MemoirFollowUps
          questionId={questionId}
          questionText={questionText}
          answer={text}
          onUse={addFollowUp}
          disabled={busy !== null}
          aiMode={aiMode}
          t={t}
        />
      )}

      <div className="memoir-voice">
        {recorder.status === 'recording' ? (
          <button type="button" className="memoir-record active" onClick={recorder.stop}>
            <span className="codicon codicon-debug-stop" aria-hidden="true" />
            {t('memoirStopRecording')}
            <span className="memoir-record-time" aria-live="polite">
              {t('memoirRecordingTime', { time: formatRecordingTime(recorder.seconds) })}
            </span>
          </button>
        ) : (
          recordingAvailable && (
            <button type="button" className="memoir-record" onClick={() => void recorder.start()} disabled={busy !== null}>
              <span className="codicon codicon-mic" aria-hidden="true" />
              {t('memoirRecord')}
            </button>
          )
        )}
        <button type="button" className="memoir-secondary" disabled={busy !== null || recorder.status === 'recording'} onClick={() => fileInput.current?.click()}>
          <span className="codicon codicon-cloud-upload" aria-hidden="true" />
          {t('memoirUploadRecording')}
        </button>
        <input ref={fileInput} type="file" accept={ACCEPTED_AUDIO} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFile} />
      </div>
      {recorder.status === 'unavailable' && <p className="memoir-error" role="alert">{t('memoirMicrophoneError')}</p>}

      {recorder.recording && (
        <div className="memoir-recording">
          <p id={`${fieldId}-recording`}>{t('memoirRecordingReady', {
            detail: recorder.recording.seconds === null ? recorder.recording.file.name : formatRecordingTime(recorder.recording.seconds),
          })}</p>
          <audio controls preload="metadata" src={recorder.recording.url} aria-labelledby={`${fieldId}-recording`}>
            <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} srcLang={t('languageCode')} label={t('captionsUnavailable')} default />
          </audio>
          <div className="memoir-actions">
            {transcriptionOn && (
              <button type="button" className="memoir-secondary" disabled={busy !== null} onClick={() => void handleTranscribe()}>
                <span className="codicon codicon-symbol-text" aria-hidden="true" />
                {busy === 'transcribing' ? t('memoirTranscribing') : t('memoirTranscribe')}
              </button>
            )}
            <button type="button" className="memoir-secondary" disabled={busy !== null} onClick={recorder.clear}>
              <span className="codicon codicon-trash" aria-hidden="true" />
              {t('memoirDiscardRecording')}
            </button>
          </div>
        </div>
      )}

      <MemoirEraField
        eras={eras}
        answerDate={answerDate}
        value={eraId}
        onChange={setEraId}
        disabled={busy !== null}
        language={language}
        t={t}
      />

      {problem && <p className="memoir-error" role="alert">{t(problem)}</p>}
      <div className="memoir-actions">
        <button type="submit" className="memoir-primary" disabled={busy !== null || recorder.status === 'recording'}>
          <span className="codicon codicon-save" aria-hidden="true" />
          {busy === 'saving' ? t('memoirSaving') : t('memoirSaveAnswer')}
        </button>
        <button type="button" className="memoir-secondary" onClick={onCancel} disabled={busy === 'saving'}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

export default MemoirAnswerForm;
