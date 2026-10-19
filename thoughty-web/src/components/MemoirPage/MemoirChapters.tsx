import type { ReactNode } from 'react';

import type { MemoirChapter } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { localize, type MemoirLanguage } from './memoirFormat';
import './MemoirChapters.css';

interface MemoirChaptersProps {
  readonly chapters: readonly MemoirChapter[];
  readonly currentQuestionId: string | null;
  readonly activeQuestionId: string | null;
  readonly canAnswer: boolean;
  readonly language: MemoirLanguage;
  readonly renderAnswerForm: (questionId: string, questionText: string) => ReactNode;
  readonly onAnswer: (questionId: string) => void;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

/** Every question by chapter, so writers can answer in any order and reopen what they wrote. */
function MemoirChapters({
  chapters,
  currentQuestionId,
  activeQuestionId,
  canAnswer,
  language,
  renderAnswerForm,
  onAnswer,
  onOpenEntry,
  t,
}: MemoirChaptersProps) {
  return (
    <section className="memoir-card" aria-labelledby="memoir-chapters-heading">
      <h2 id="memoir-chapters-heading">{t('memoirAllQuestions')}</h2>
      <p className="memoir-hint">{t('memoirAllQuestionsHint')}</p>
      {chapters.map((chapter) => {
        const headingId = `memoir-chapter-${chapter.id}`;
        return (
          <section key={chapter.id} className="memoir-chapter" aria-labelledby={headingId}>
            <h3 id={headingId}>{localize(chapter.title, language)}</h3>
            <ol className="memoir-questions">
              {chapter.questions.map((question) => {
                const text = localize(question.text, language);
                const answer = question.answer;
                return (
                  <li key={question.id} id={`memoir-question-${question.id}`} className={answer ? 'answered' : undefined}>
                    <div className="memoir-question-row">
                      <span className={`codicon codicon-${answer ? 'pass-filled' : 'circle-large'} memoir-question-icon`} aria-hidden="true" />
                      <p className="memoir-question-text">
                        {text}
                        {question.id === currentQuestionId && <span className="memoir-badge">{t('memoirThisWeekBadge')}</span>}
                        {answer && <span className="sr-only">{` (${t('memoirAnswered')})`}</span>}
                      </p>
                      {answer ? (
                        <button type="button" className="memoir-link" onClick={() => onOpenEntry(answer.entryId)}>
                          {t('memoirOpenAnswer')}
                        </button>
                      ) : (
                        activeQuestionId !== question.id && (
                          <button
                            type="button"
                            className="memoir-link"
                            disabled={!canAnswer}
                            aria-label={`${t('memoirAnswerQuestion')}: ${text}`}
                            onClick={() => onAnswer(question.id)}
                          >
                            {t('memoirAnswerQuestion')}
                          </button>
                        )
                      )}
                    </div>
                    {activeQuestionId === question.id && !answer && renderAnswerForm(question.id, text)}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </section>
  );
}

export default MemoirChapters;
