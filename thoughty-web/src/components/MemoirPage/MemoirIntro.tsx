import { useState, type FormEvent } from 'react';

import type { MemoirChapter, StartMemoirRequest } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import MemoirScheduleFields from './MemoirScheduleFields';
import { browserTimeZone, localize, type MemoirLanguage } from './memoirFormat';

const NEW_DIARY = 'new';

interface MemoirIntroProps {
  readonly chapters: readonly MemoirChapter[];
  readonly diaries: readonly Diary[];
  readonly language: MemoirLanguage;
  readonly onStart: (request: StartMemoirRequest) => Promise<boolean>;
  readonly t: TranslationFunction;
}

function MemoirIntro({ chapters, diaries, language, onStart, t }: MemoirIntroProps) {
  const timeZone = browserTimeZone();
  const [diaryChoice, setDiaryChoice] = useState(NEW_DIARY);
  const [diaryName, setDiaryName] = useState(() => t('memoirDefaultDiaryName'));
  const [weekday, setWeekday] = useState(() => new Date().getDay());
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const questionCount = chapters.reduce((total, chapter) => total + chapter.questions.length, 0);
  const canStart = diaryChoice !== NEW_DIARY || diaryName.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canStart || starting) return;
    setStarting(true);
    setFailed(false);
    const diary = diaryChoice === NEW_DIARY ? { diaryName: diaryName.trim() } : { diaryId: Number(diaryChoice) };
    const started = await onStart({ ...diary, emailEnabled, deliveryWeekday: weekday, timeZone });
    setStarting(false);
    setFailed(!started);
  };

  return (
    <section className="memoir-intro" aria-labelledby="memoir-intro-heading">
      <div className="memoir-card memoir-intro-story">
        <h2 id="memoir-intro-heading">{t('memoirIntroTitle')}</h2>
        <p>{t('memoirIntroBody')}</p>
        <p className="memoir-intro-stats">{t('memoirIntroStats', { questions: questionCount, chapters: chapters.length })}</p>
        <ul className="memoir-chapter-chips">
          {chapters.map((chapter) => <li key={chapter.id}>{localize(chapter.title, language)}</li>)}
        </ul>
      </div>

      <form className="memoir-card memoir-form" onSubmit={(event) => void handleSubmit(event)} aria-labelledby="memoir-start-heading">
        <h2 id="memoir-start-heading">{t('memoirStartTitle')}</h2>
        <div className="memoir-field">
          <label htmlFor="memoir-start-diary">{t('memoirDiaryLabel')}</label>
          <select id="memoir-start-diary" value={diaryChoice} onChange={(event) => setDiaryChoice(event.target.value)}>
            <option value={NEW_DIARY}>{t('memoirNewDiaryOption')}</option>
            {diaries.map((diary) => (
              <option key={diary.id} value={diary.id}>{`${diary.icon} ${diary.name}`}</option>
            ))}
          </select>
        </div>
        {diaryChoice === NEW_DIARY && (
          <div className="memoir-field">
            <label htmlFor="memoir-start-diary-name">{t('memoirDiaryNameLabel')}</label>
            <input
              id="memoir-start-diary-name"
              type="text"
              value={diaryName}
              maxLength={100}
              required
              onChange={(event) => setDiaryName(event.target.value)}
            />
          </div>
        )}
        <MemoirScheduleFields
          idPrefix="memoir-start"
          weekday={weekday}
          emailEnabled={emailEnabled}
          timeZone={timeZone}
          language={language}
          onWeekdayChange={setWeekday}
          onEmailEnabledChange={setEmailEnabled}
          t={t}
        />
        <button type="submit" className="memoir-primary" disabled={!canStart || starting}>
          <span className="codicon codicon-play" aria-hidden="true" />
          {starting ? t('memoirStarting') : t('memoirStart')}
        </button>
        {failed && <p className="memoir-error" role="alert">{t('memoirStartError')}</p>}
      </form>
    </section>
  );
}

export default MemoirIntro;
