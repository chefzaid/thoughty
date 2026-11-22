import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import type { AnswerMemoirPhotoRequest, LifeEra, MemoirAnswerRef, MemoirChapter } from '../../services/api';
import type { TranslationFunction } from '../../types';
import MemoirEraField from './MemoirEraField';
import { formatAnsweredDay, localize, type MemoirLanguage } from './memoirFormat';
import { useRecordingUpload } from './useRecordingUpload';
import './MemoirPhotoPrompt.css';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** The pictures a book can print. */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface MemoirPhotoPromptProps {
  /** The chapters of the writer's memoir, any of which a photo story can join. */
  readonly chapters: readonly MemoirChapter[];
  /** The photo stories told so far, newest first. */
  readonly photoAnswers: readonly MemoirAnswerRef[];
  readonly eras: readonly LifeEra[];
  /** The day the story will be dated (`YYYY-MM-DD`). */
  readonly answerDate: string;
  readonly timeZone: string;
  readonly language: MemoirLanguage;
  /** Saves the story; null once saved, else the translation key of what went wrong. */
  readonly onSubmit: (request: AnswerMemoirPhotoRequest) => Promise<string | null>;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

type ChapterChoice = NonNullable<AnswerMemoirPhotoRequest['chapterId']> | '';

interface ChosenPhoto {
  readonly file: File;
  readonly url: string;
}

/** Photo prompts: upload an old photo, tell what is happening in it, and find the stories told so far. */
function MemoirPhotoPrompt({ chapters, photoAnswers, eras, answerDate, timeZone, language, onSubmit, onOpenEntry, t }: MemoirPhotoPromptProps) {
  const id = useId();
  const { upload } = useRecordingUpload();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<ChosenPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [text, setText] = useState('');
  const [chapterId, setChapterId] = useState<ChapterChoice>('');
  const [eraId, setEraId] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // The preview's object URL lives as long as the photo is chosen
  useEffect(() => (photo ? () => URL.revokeObjectURL(photo.url) : undefined), [photo]);

  useEffect(() => {
    if (open) {
      chooseButton.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      startButton.current?.focus();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setPhoto(null);
    setCaption('');
    setText('');
    setChapterId('');
    setEraId(null);
    setProblem(null);
    returnFocus.current = true;
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setProblem('memoirPhotoNotImage');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setProblem('memoirPhotoTooLarge');
      return;
    }
    setProblem(null);
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!photo) {
      setProblem('memoirPhotoMissing');
      return;
    }
    if (!text.trim()) {
      setProblem('memoirPhotoStoryEmpty');
      return;
    }
    setSaving(true);
    setProblem(null);
    const attachmentId = await upload(photo.file);
    const failure = attachmentId
      ? await onSubmit({
          attachmentId,
          text: text.trim(),
          ...(caption.trim() ? { caption: caption.trim() } : {}),
          ...(chapterId ? { chapterId } : {}),
          ...(eraId ? { eraId } : {}),
        })
      : 'memoirPhotoUploadError';
    setSaving(false);
    if (failure) {
      setProblem(failure);
    } else {
      close();
    }
  };

  return (
    <section className="memoir-card memoir-photos" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('memoirPhotoTitle')}</h2>
      <p className="memoir-hint">{t('memoirPhotoIntro')}</p>

      {open ? (
        <form className="memoir-answer-form memoir-photo-form" aria-labelledby={`${id}-heading`} onSubmit={(event) => void handleSubmit(event)}>
          <div className="memoir-actions">
            <button ref={chooseButton} type="button" className="memoir-secondary" disabled={saving} onClick={() => fileInput.current?.click()}>
              <span className="codicon codicon-file-media" aria-hidden="true" />
              {photo ? t('memoirPhotoChooseAnother') : t('memoirPhotoChoose')}
            </button>
            <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFile} />
          </div>
          {photo && (
            <figure className="memoir-photo-chosen">
              <img src={photo.url} alt={caption.trim() || t('memoirPhotoPreviewAlt')} className="memoir-photo-preview" />
              <figcaption className="memoir-hint">{t('memoirPhotoChosen', { name: photo.file.name })}</figcaption>
            </figure>
          )}

          <div className="memoir-field">
            <label htmlFor={`${id}-caption`}>{t('memoirPhotoCaption')}</label>
            <input
              id={`${id}-caption`}
              className="privacy-text"
              value={caption}
              maxLength={200}
              aria-describedby={`${id}-caption-hint`}
              onChange={(event) => setCaption(event.target.value)}
            />
            <p id={`${id}-caption-hint`} className="memoir-hint">{t('memoirPhotoCaptionHint')}</p>
          </div>

          <label htmlFor={`${id}-story`} className="memoir-answer-label">{t('memoirPhotoQuestion')}</label>
          <textarea
            id={`${id}-story`}
            className="privacy-text"
            value={text}
            rows={6}
            maxLength={45000}
            placeholder={t('memoirPhotoStoryPlaceholder')}
            aria-describedby={`${id}-story-note`}
            onChange={(event) => setText(event.target.value)}
          />
          <p id={`${id}-story-note`} className="memoir-hint">{t('memoirPrivateNote')}</p>

          <div className="memoir-field memoir-photo-chapter">
            <label htmlFor={`${id}-chapter`}>{t('memoirPhotoChapter')}</label>
            <select id={`${id}-chapter`} value={chapterId} disabled={saving} aria-describedby={`${id}-chapter-hint`} onChange={(event) => setChapterId(event.target.value as ChapterChoice)}>
              <option value="">{t('memoirPhotoChapterNone')}</option>
              {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{localize(chapter.title, language)}</option>)}
            </select>
            <p id={`${id}-chapter-hint`} className="memoir-hint">{t('memoirPhotoChapterHint')}</p>
          </div>

          <MemoirEraField eras={eras} answerDate={answerDate} value={eraId} onChange={setEraId} disabled={saving} language={language} t={t} />

          {problem && <p className="memoir-error" role="alert">{t(problem)}</p>}
          <div className="memoir-actions">
            <button type="submit" className="memoir-primary" disabled={saving}>
              <span className="codicon codicon-save" aria-hidden="true" />
              {saving ? t('memoirSaving') : t('memoirPhotoSave')}
            </button>
            <button type="button" className="memoir-secondary" onClick={close} disabled={saving}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="memoir-actions">
          <button ref={startButton} type="button" className="memoir-primary" onClick={() => setOpen(true)}>
            <span className="codicon codicon-file-media" aria-hidden="true" />
            {t('memoirPhotoStart')}
          </button>
        </div>
      )}

      {photoAnswers.length > 0 && (
        <>
          <h3 id={`${id}-stories`} className="memoir-photo-stories-heading">{t('memoirPhotoStories')}</h3>
          <ul className="memoir-photo-stories" aria-labelledby={`${id}-stories`}>
            {photoAnswers.map((answer) => {
              const label = t('memoirPhotoStoryOn', { date: formatAnsweredDay(answer.answeredAt, timeZone, language) });
              return (
                <li key={answer.entryId}>
                  <span>{label}</span>
                  <button type="button" className="memoir-link" aria-label={`${t('memoirPhotoOpen')}: ${label}`} onClick={() => onOpenEntry(answer.entryId)}>
                    {t('memoirPhotoOpen')}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export default MemoirPhotoPrompt;
