import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { AnswerMemoirRequest } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { EMPTY_CAPTIONS_TRACK_URL } from '../../utils/attachments';
import { useRecordingUpload } from '../MemoirPage/useRecordingUpload';
import { formatRecordingTime, isVoiceRecordingSupported, useVoiceRecorder } from '../MemoirPage/useVoiceRecorder';

type Problem = 'empty' | 'upload' | 'save' | null;

const PROBLEM_MESSAGES: Record<Exclude<Problem, null>, string> = {
  empty: 'memoirAnswerEmpty',
  upload: 'memoirUploadError',
  save: 'memoirAnswerError',
};

interface SimpleMemoirAnswerProps {
  readonly questionId: string;
  readonly onSubmit: (request: AnswerMemoirRequest) => Promise<boolean>;
  readonly t: TranslationFunction;
}

/**
 * One record button: record, stop, listen back, then save or record again. Without a microphone
 * (an old browser, or the permission refused) it offers a large text field instead.
 */
function SimpleMemoirAnswer({ questionId, onSubmit, t }: SimpleMemoirAnswerProps) {
  const recorder = useVoiceRecorder();
  const { upload } = useRecordingUpload();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const textField = useRef<HTMLTextAreaElement>(null);
  const canRecord = isVoiceRecordingSupported() && recorder.status !== 'unavailable';
  const recording = recorder.status === 'recording';
  const recorded = recorder.recording;

  // The button pressed goes away, so focus moves to the one that takes its place
  useEffect(() => {
    if (recording) stopButton.current?.focus();
  }, [recording]);
  useEffect(() => {
    if (recorded) saveButton.current?.focus();
  }, [recorded]);
  useEffect(() => {
    if (recorder.status === 'unavailable') textField.current?.focus();
  }, [recorder.status]);

  const save = async (answer: AnswerMemoirRequest) => {
    setSaving(true);
    setProblem(null);
    const saved = await onSubmit(answer);
    setSaving(false);
    if (!saved) setProblem('save');
  };

  const saveRecording = async () => {
    if (!recorded || saving) return;
    setSaving(true);
    setProblem(null);
    const attachmentId = await upload(recorded.file);
    if (!attachmentId) {
      setSaving(false);
      setProblem('upload');
      return;
    }
    await save({ questionId, text: '', attachmentIds: [attachmentId] });
  };

  const saveText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!text.trim()) {
      setProblem('empty');
      return;
    }
    void save({ questionId, text: text.trim() });
  };

  const problemMessage = problem && <p className="simple-memoir-error" role="alert">{t(PROBLEM_MESSAGES[problem])}</p>;

  if (!canRecord) {
    const fieldId = `simple-memoir-answer-${questionId}`;
    return (
      <form className="simple-memoir-answer" onSubmit={saveText}>
        <p className="simple-memoir-note">{t('memoirSimpleWriteInstead')}</p>
        <label htmlFor={fieldId} className="simple-memoir-label">{t('memoirYourAnswer')}</label>
        <textarea
          id={fieldId}
          ref={textField}
          className="privacy-text"
          value={text}
          rows={6}
          maxLength={45000}
          onChange={(event) => setText(event.target.value)}
        />
        {problemMessage}
        <button type="submit" className="simple-memoir-primary" disabled={saving}>
          <span className="codicon codicon-save" aria-hidden="true" />
          {saving ? t('memoirSaving') : t('memoirSimpleSave')}
        </button>
      </form>
    );
  }

  if (recording) {
    return (
      <div className="simple-memoir-answer">
        <button ref={stopButton} type="button" className="simple-memoir-record active" onClick={recorder.stop}>
          <span className="codicon codicon-debug-stop" aria-hidden="true" />
          {t('memoirStopRecording')}
        </button>
        <p className="simple-memoir-timer" role="timer">{t('memoirRecordingTime', { time: formatRecordingTime(recorder.seconds) })}</p>
      </div>
    );
  }

  if (recorded) {
    return (
      <div className="simple-memoir-answer">
        <p id="simple-memoir-listen" className="simple-memoir-label">{t('memoirSimpleListen')}</p>
        <audio controls preload="metadata" src={recorded.url} aria-labelledby="simple-memoir-listen">
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} srcLang={t('languageCode')} label={t('captionsUnavailable')} default />
        </audio>
        {problemMessage}
        <button ref={saveButton} type="button" className="simple-memoir-primary" disabled={saving} onClick={() => void saveRecording()}>
          <span className="codicon codicon-save" aria-hidden="true" />
          {saving ? t('memoirSaving') : t('memoirSimpleSave')}
        </button>
        <button type="button" className="simple-memoir-secondary" disabled={saving} onClick={() => void recorder.start()}>
          <span className="codicon codicon-refresh" aria-hidden="true" />
          {t('memoirSimpleRecordAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="simple-memoir-answer">
      <button type="button" className="simple-memoir-record" onClick={() => void recorder.start()}>
        <span className="codicon codicon-mic" aria-hidden="true" />
        {t('memoirRecord')}
      </button>
    </div>
  );
}

export default SimpleMemoirAnswer;
