import type { ReactNode } from 'react';

import type { MemoirProgram, MemoirQuestion } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { formatDeliveryDate, localize, type MemoirLanguage } from './memoirFormat';

interface MemoirQuestionCardProps {
  readonly program: MemoirProgram;
  readonly question: MemoirQuestion | null;
  readonly chapterTitle: string;
  readonly language: MemoirLanguage;
  readonly answering: boolean;
  readonly skipping: boolean;
  readonly answerForm: ReactNode;
  readonly onAnswer: () => void;
  readonly onSkip: () => void;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

/** This week's question: answer it, ask for another one, or see when the next one arrives. */
function MemoirQuestionCard({
  program,
  question,
  chapterTitle,
  language,
  answering,
  skipping,
  answerForm,
  onAnswer,
  onSkip,
  onOpenEntry,
  t,
}: MemoirQuestionCardProps) {
  const nextDate = formatDeliveryDate(program.nextDeliveryAt, program.timeZone, language);

  if (!question) {
    return (
      <section className="memoir-card memoir-week" aria-labelledby="memoir-week-heading">
        <h2 id="memoir-week-heading">{t('memoirThisWeek')}</h2>
        <p className="memoir-week-note">{t('memoirComplete')}</p>
      </section>
    );
  }

  const answer = question.answer;

  return (
    <section className="memoir-card memoir-week" aria-labelledby="memoir-week-heading">
      <h2 id="memoir-week-heading">{t('memoirThisWeek')}</h2>
      <p className="memoir-eyebrow">{chapterTitle}</p>
      <p className="memoir-week-question">{localize(question.text, language)}</p>
      {answer ? (
        <p className="memoir-week-note">
          <span className="codicon codicon-pass-filled" aria-hidden="true" /> {t('memoirAnsweredThisWeek', { date: nextDate })}
        </p>
      ) : (
        program.status === 'active' && <p className="memoir-week-note">{t('memoirNextQuestion', { date: nextDate })}</p>
      )}
      {answering ? (
        answerForm
      ) : (
        <div className="memoir-actions">
          {answer ? (
            <button type="button" className="memoir-secondary" onClick={() => onOpenEntry(answer.entryId)}>
              <span className="codicon codicon-go-to-file" aria-hidden="true" />
              {t('memoirOpenAnswer')}
            </button>
          ) : (
            <button type="button" className="memoir-primary" onClick={onAnswer} disabled={!program.diaryId}>
              <span className="codicon codicon-edit" aria-hidden="true" />
              {t('memoirAnswerQuestion')}
            </button>
          )}
          <button type="button" className="memoir-secondary" onClick={onSkip} disabled={skipping}>
            <span className="codicon codicon-refresh" aria-hidden="true" />
            {t('memoirSkip')}
          </button>
        </div>
      )}
    </section>
  );
}

export default MemoirQuestionCard;
