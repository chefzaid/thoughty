import type { ReactNode } from 'react';

import type { MemoirProgram, MemoirQuestion } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { formatDeliveryDate, formatMemoirDay, localize, type MemoirLanguage } from './memoirFormat';

/** Which of the week's actions is waiting for the API, if any. */
export type MemoirWeekAction = 'skip' | 'snooze' | null;

interface MemoirQuestionCardProps {
  readonly program: MemoirProgram;
  readonly question: MemoirQuestion | null;
  readonly chapterTitle: string;
  /** With no question this week: the first day a set-aside question comes back, or null when all are answered. */
  readonly firstReturnDay: string | null;
  readonly language: MemoirLanguage;
  readonly answering: boolean;
  readonly pending: MemoirWeekAction;
  readonly answerForm: ReactNode;
  readonly onAnswer: () => void;
  readonly onSkip: () => void;
  readonly onSnooze: () => void;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

/** This week's question: answer it, skip it, set it aside for a few weeks, or see when the next one arrives. */
function MemoirQuestionCard({
  program,
  question,
  chapterTitle,
  firstReturnDay,
  language,
  answering,
  pending,
  answerForm,
  onAnswer,
  onSkip,
  onSnooze,
  onOpenEntry,
  t,
}: MemoirQuestionCardProps) {
  const nextDate = formatDeliveryDate(program.nextDeliveryAt, program.timeZone, language);

  if (!question) {
    return (
      <section className="memoir-card memoir-week" aria-labelledby="memoir-week-heading">
        <h2 id="memoir-week-heading">{t('memoirThisWeek')}</h2>
        <p className="memoir-week-note">
          {firstReturnDay ? t('memoirAllSetAside', { date: formatMemoirDay(firstReturnDay, language) }) : t('memoirComplete')}
        </p>
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
        <>
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
            {!answer && (
              <button
                type="button"
                className="memoir-secondary"
                onClick={onSnooze}
                disabled={pending !== null}
                aria-describedby="memoir-snooze-hint"
              >
                <span className="codicon codicon-history" aria-hidden="true" />
                {t('memoirSnooze')}
              </button>
            )}
            <button
              type="button"
              className="memoir-secondary"
              onClick={onSkip}
              disabled={pending !== null}
              aria-describedby="memoir-skip-hint"
            >
              <span className="codicon codicon-debug-step-over" aria-hidden="true" />
              {t('memoirSkip')}
            </button>
          </div>
          <p className="memoir-hint memoir-week-choices">
            {!answer && <span id="memoir-snooze-hint">{t('memoirSnoozeHint')}</span>}
            <span id="memoir-skip-hint">{t('memoirSkipHint')}</span>
          </p>
        </>
      )}
    </section>
  );
}

export default MemoirQuestionCard;
