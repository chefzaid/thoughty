import { useEffect, useRef, useState } from 'react';

import { useTransientMessage } from '../../hooks/useTransientMessage';
import type { AnswerMemoirRequest, MemoirChapter, StartMemoirRequest, UpdateMemoirRequest } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import AutoDismiss from '../AutoDismiss/AutoDismiss';
import PageHeader from '../PageHeader/PageHeader';
import MemoirAnswerForm from './MemoirAnswerForm';
import MemoirChapters from './MemoirChapters';
import MemoirIntro from './MemoirIntro';
import MemoirProgress from './MemoirProgress';
import MemoirQuestionCard, { type MemoirWeekAction } from './MemoirQuestionCard';
import MemoirSettings from './MemoirSettings';
import { resolveLanguage } from '../../utils/language';
import { formatMemoirDay, localize, todayIn } from './memoirFormat';
import { useMemoir } from './useMemoir';
import { useLifeEraList } from '../LifeEras/useLifeEras';
import './MemoirPage.css';

export interface MemoirPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly diaries: readonly Diary[];
  /** A question to open straight away, e.g. from the weekly email link. */
  readonly initialQuestionId?: string | null;
  readonly onOpenEntry: (entryId: number) => void;
  readonly onOpenBook: (diaryId: number) => void;
  readonly onDiariesChanged: () => Promise<unknown> | void;
  readonly t: TranslationFunction;
}

function findQuestion(chapters: readonly MemoirChapter[], questionId: string | null) {
  for (const chapter of chapters) {
    const question = chapter.questions.find((candidate) => candidate.id === questionId);
    if (question) return { chapter, question };
  }
  return null;
}

/** The first day a question set aside with "Not this week" comes back, among those still unanswered. */
function firstReturnDay(chapters: readonly MemoirChapter[]): string | null {
  const days = chapters.flatMap((chapter) => chapter.questions.map((question) => question.snoozedUntil)).filter((day) => day !== null);
  return days.length > 0 ? days.reduce((first, day) => (day < first ? day : first)) : null;
}

function MemoirPage({
  theme = 'dark',
  language: rawLanguage,
  diaries,
  initialQuestionId = null,
  onOpenEntry,
  onOpenBook,
  onDiariesChanged,
  t,
}: MemoirPageProps) {
  const language = resolveLanguage(rawLanguage);
  const memoir = useMemoir();
  const { eras } = useLifeEraList();
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(initialQuestionId);
  const [pending, setPending] = useState<MemoirWeekAction>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const toast = useTransientMessage();
  const [toastText, setToastText] = useState('');
  const scrolledToInitial = useRef(false);
  const overview = memoir.overview;
  const program = overview?.program ?? null;

  useEffect(() => {
    if (!program || !initialQuestionId || scrolledToInitial.current) return;
    scrolledToInitial.current = true;
    document.getElementById(`memoir-question-${initialQuestionId}`)?.scrollIntoView?.({ block: 'center' });
  }, [program, initialQuestionId]);

  const handleStart = async (request: StartMemoirRequest) => {
    const result = await memoir.start(request);
    if (result.data) await onDiariesChanged();
    return Boolean(result.data);
  };

  const handleUpdate = async (request: UpdateMemoirRequest) => Boolean((await memoir.update(request)).data);

  const handleLeave = async () => {
    const result = await memoir.leave();
    if (result.data) setActiveQuestionId(null);
    return Boolean(result.data);
  };

  const handleAnswer = async (request: AnswerMemoirRequest) => {
    const result = await memoir.answer(request);
    if (result.data) {
      setActiveQuestionId(null);
      showToast(t('memoirAnswerSaved'));
    }
    return Boolean(result.data);
  };

  const showToast = (text: string) => {
    setToastText(text);
    toast.show();
  };

  const handleWeekAction = async (action: Exclude<MemoirWeekAction, null>) => {
    const questionId = program?.currentQuestionId ?? null;
    setPending(action);
    setActionFailed(false);
    const result = await (action === 'skip' ? memoir.skip() : memoir.snooze());
    setPending(null);
    setActionFailed(!result.data);
    if (!result.data) return;
    setActiveQuestionId(null);
    const setAside = action === 'snooze' ? findQuestion(result.data.chapters, questionId)?.question.snoozedUntil : null;
    if (setAside) showToast(t('memoirSnoozed', { date: formatMemoirDay(setAside, language) }));
  };

  const renderAnswerForm = (questionId: string, questionText: string) => (
    <MemoirAnswerForm
      key={questionId}
      questionId={questionId}
      questionText={questionText}
      onSubmit={handleAnswer}
      onCancel={() => setActiveQuestionId(null)}
      eras={eras}
      answerDate={todayIn(program?.timeZone ?? 'UTC')}
      language={language}
      t={t}
    />
  );

  const current = overview && program ? findQuestion(overview.chapters, program.currentQuestionId) : null;
  const currentText = current ? localize(current.question.text, language) : '';

  return (
    <section className={`memoir-page ${theme}`} aria-labelledby="memoir-heading">
      <PageHeader title={t('memoir')} titleId="memoir-heading" subtitle={t('memoirTagline')} theme={theme} />

      {memoir.loading && (
        <output className="memoir-state">
          <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" /> {t('loading')}
        </output>
      )}
      {memoir.loadError && !overview && (
        <div className="memoir-state error" role="alert">
          <p>{t('memoirLoadError')}</p>
          <button type="button" className="memoir-secondary" onClick={memoir.retry}>
            <span className="codicon codicon-refresh" aria-hidden="true" /> {t('tryAgain')}
          </button>
        </div>
      )}

      {overview && !program && (
        <MemoirIntro chapters={overview.chapters} diaries={diaries} language={language} onStart={handleStart} t={t} />
      )}

      {overview && program && (
        <>
          {program.status === 'paused' && <p className="memoir-notice">{t('memoirPausedNotice')}</p>}
          {!program.diaryId && <p className="memoir-notice" role="alert">{t('memoirNoDiary')}</p>}
          {program.emailEnabled && !program.emailAvailable && <p className="memoir-notice">{t('memoirEmailUnavailable')}</p>}
          {actionFailed && <p className="memoir-error" role="alert">{t('memoirSaveError')}</p>}

          <div className="memoir-grid">
            <MemoirQuestionCard
              program={program}
              question={current?.question ?? null}
              chapterTitle={current ? localize(current.chapter.title, language) : ''}
              firstReturnDay={firstReturnDay(overview.chapters)}
              language={language}
              answering={Boolean(current && activeQuestionId === current.question.id && !current.question.answer)}
              pending={pending}
              answerForm={current ? renderAnswerForm(current.question.id, currentText) : null}
              onAnswer={() => current && setActiveQuestionId(current.question.id)}
              onSkip={() => void handleWeekAction('skip')}
              onSnooze={() => void handleWeekAction('snooze')}
              onOpenEntry={onOpenEntry}
              t={t}
            />
            <MemoirProgress
              progress={overview.progress}
              chapters={overview.chapters}
              language={language}
              canMakeBook={Boolean(program.diaryId) && overview.progress.answered > 0}
              onMakeBook={() => program.diaryId && onOpenBook(program.diaryId)}
              t={t}
            />
          </div>

          <MemoirChapters
            chapters={overview.chapters}
            currentQuestionId={program.currentQuestionId}
            activeQuestionId={activeQuestionId === program.currentQuestionId ? null : activeQuestionId}
            canAnswer={Boolean(program.diaryId)}
            language={language}
            renderAnswerForm={renderAnswerForm}
            onAnswer={setActiveQuestionId}
            onOpenEntry={onOpenEntry}
            t={t}
          />

          <MemoirSettings
            key={program.startedAt}
            program={program}
            diaries={diaries}
            language={language}
            theme={theme}
            onUpdate={handleUpdate}
            onLeave={handleLeave}
            t={t}
          />
        </>
      )}

      <AutoDismiss message={toast} durationMs={4000}>
        <p className="memoir-toast" role="status">{toastText}</p>
      </AutoDismiss>
    </section>
  );
}

export default MemoirPage;
