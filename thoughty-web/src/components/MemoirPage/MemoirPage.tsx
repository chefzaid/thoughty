import { useEffect, useRef, useState } from 'react';

import { useTransientMessage } from '../../hooks/useTransientMessage';
import type { AnswerMemoirRequest, MemoirChapter, StartMemoirRequest, UpdateMemoirRequest } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import AutoDismiss from '../AutoDismiss/AutoDismiss';
import MemoirAnswerForm from './MemoirAnswerForm';
import MemoirChapters from './MemoirChapters';
import MemoirIntro from './MemoirIntro';
import MemoirProgress from './MemoirProgress';
import MemoirQuestionCard from './MemoirQuestionCard';
import MemoirSettings from './MemoirSettings';
import { localize, resolveMemoirLanguage } from './memoirFormat';
import { useMemoir } from './useMemoir';
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
  const language = resolveMemoirLanguage(rawLanguage);
  const memoir = useMemoir();
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(initialQuestionId);
  const [skipping, setSkipping] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const answerSaved = useTransientMessage();
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
      answerSaved.show();
    }
    return Boolean(result.data);
  };

  const handleSkip = async () => {
    setSkipping(true);
    setActionFailed(false);
    const result = await memoir.skip();
    setSkipping(false);
    setActionFailed(!result.data);
    if (result.data) setActiveQuestionId(null);
  };

  const renderAnswerForm = (questionId: string, questionText: string) => (
    <MemoirAnswerForm
      key={questionId}
      questionId={questionId}
      questionText={questionText}
      onSubmit={handleAnswer}
      onCancel={() => setActiveQuestionId(null)}
      t={t}
    />
  );

  const current = overview && program ? findQuestion(overview.chapters, program.currentQuestionId) : null;
  const currentText = current ? localize(current.question.text, language) : '';

  return (
    <section className={`memoir-page ${theme}`} aria-labelledby="memoir-heading">
      <header className="memoir-header">
        <h1 id="memoir-heading">{t('memoir')}</h1>
        <p>{t('memoirTagline')}</p>
      </header>

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
              language={language}
              answering={Boolean(current && activeQuestionId === current.question.id && !current.question.answer)}
              skipping={skipping}
              answerForm={current ? renderAnswerForm(current.question.id, currentText) : null}
              onAnswer={() => current && setActiveQuestionId(current.question.id)}
              onSkip={() => void handleSkip()}
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

      <AutoDismiss message={answerSaved} durationMs={4000}>
        <p className="memoir-toast" role="status">{t('memoirAnswerSaved')}</p>
      </AutoDismiss>
    </section>
  );
}

export default MemoirPage;
