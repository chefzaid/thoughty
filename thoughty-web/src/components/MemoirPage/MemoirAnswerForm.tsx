import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createAttachmentsService, type AnswerMemoirRequest, type LifeEra } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { EMPTY_CAPTIONS_TRACK_URL } from '../../utils/attachments';
import type { Language } from '../../utils/translations';
import MemoirEraField from './MemoirEraField';
import { formatRecordingTime, isVoiceRecordingSupported, useVoiceRecorder } from './useVoiceRecorder';
import './MemoirAnswerForm.css';

const MAX_RECORDING_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AUDIO = 'audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm';

type FormProblem = 'empty' | 'tooLarge' | 'upload' | 'transcribe' | 'save' | null;

const PROBLEM_MESSAGES: Record<Exclude<FormProblem, null>, string> = {
  empty: 'memoirAnswerEmpty',
  tooLarge: 'memoirRecordingTooLarge',
  upload: 'memoirUploadError',
  transcribe: 'memoirTranscribeError',
  save: 'memoirAnswerError',
};

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
  readonly t: TranslationFunction;
}

function MemoirAnswerForm({ questionId, questionText, onSubmit, onCancel, eras = [], answerDate = '', language = 'en', t }: MemoirAnswerFormProps) {
  const attachmentsService = useAuthenticatedService(createAttachmentsService);
  const recorder = useVoiceRecorder();
  const [text, setText] = useState('');
  const [eraId, setEraId] = useState<number | null>(null);
  const [problem, setProblem] = useState<FormProblem>(null);
  const [busy, setBusy] = useState<'transcribing' | 'saving' | null>(null);
  const uploaded = useRef<{ file: File; id: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fieldId = `memoir-answer-${questionId}`;
  const recordingAvailable = isVoiceRecordingSupported() && recorder.status !== 'unavailable';

  /** Uploads the current recording once, however many times it is transcribed or saved. */
  const uploadRecording = async (): Promise<number | null> => {
    const recording = recorder.recording;
    if (!recording) return null;
    if (uploaded.current?.file === recording.file) return uploaded.current.id;
    const attachment = await attachmentsService.uploadAttachment(recording.file);
    if (!attachment) return null;
    uploaded.current = { file: recording.file, id: attachment.id };
    return attachment.id;
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_RECORDING_BYTES) {
      setProblem('tooLarge');
      return;
    }
    setProblem(null);
    recorder.setRecording({ file, url: URL.createObjectURL(file), seconds: null });
  };

  const handleTranscribe = async () => {
    setBusy('transcribing');
    setProblem(null);
    const attachmentId = await uploadRecording();
    const transcription = attachmentId ? await attachmentsService.transcribeAttachment(attachmentId) : null;
    setBusy(null);
    if (!attachmentId) {
      setProblem('upload');
      return;
    }
    if (!transcription?.transcript) {
      setProblem('transcribe');
      return;
    }
    setText((current) => (current.trim() ? `${current.trim()}\n\n${transcription.transcript}` : transcription.transcript));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || recorder.status === 'recording') return;
    if (!text.trim() && !recorder.recording) {
      setProblem('empty');
      return;
    }
    setBusy('saving');
    setProblem(null);
    const attachmentId = recorder.recording ? await uploadRecording() : null;
    if (recorder.recording && !attachmentId) {
      setBusy(null);
      setProblem('upload');
      return;
    }
    const saved = await onSubmit({
      questionId,
      text: text.trim(),
      ...(attachmentId ? { attachmentIds: [attachmentId] } : {}),
      ...(eraId ? { eraId } : {}),
    });
    setBusy(null);
    if (!saved) setProblem('save');
  };

  return (
    <form className="memoir-answer-form" aria-label={questionText} onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor={fieldId} className="memoir-answer-label">{t('memoirYourAnswer')}</label>
      <textarea
        id={fieldId}
        value={text}
        rows={7}
        maxLength={45000}
        placeholder={t('memoirAnswerPlaceholder')}
        aria-describedby={`${fieldId}-note`}
        onChange={(event) => setText(event.target.value)}
      />
      <p id={`${fieldId}-note`} className="memoir-hint">{t('memoirPrivateNote')}</p>

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
            <button type="button" className="memoir-secondary" disabled={busy !== null} onClick={() => void handleTranscribe()}>
              <span className="codicon codicon-symbol-text" aria-hidden="true" />
              {busy === 'transcribing' ? t('memoirTranscribing') : t('memoirTranscribe')}
            </button>
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

      {problem && <p className="memoir-error" role="alert">{t(PROBLEM_MESSAGES[problem])}</p>}
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
