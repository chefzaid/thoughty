import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { AnswerMemoirRequest, MemoirProgram } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { getPathForView } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { formatDeliveryDate, formatMemoirDay, localize, type MemoirLanguage } from '../MemoirPage/memoirFormat';
import { useMemoir } from '../MemoirPage/useMemoir';
import SimpleMemoirAnswer from './SimpleMemoirAnswer';
import { pickSimpleMemoirView } from './simpleMemoirView';
import './SimpleMemoir.css';

export interface SimpleMemoirPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  /** A question to answer first, from the weekly email link. */
  readonly questionId?: string | null;
  readonly t: TranslationFunction;
}

const HEADING_ID = 'simple-memoir-heading';

/** When the next weekly question arrives, or that the questions are paused. */
function nextQuestionNote(program: MemoirProgram, language: MemoirLanguage, t: TranslationFunction): string {
  return program.status === 'active'
    ? t('memoirSimpleNextOn', { date: formatDeliveryDate(program.nextDeliveryAt, program.timeZone, language) })
    : t('memoirPausedNotice');
}

/**
 * Simple memoir mode: one question in large text and one record button, without the menu, the
 * footer or anything else of the journal, for someone who only ever answers the weekly question.
 */
function SimpleMemoirPage({ theme = 'dark', language: rawLanguage, questionId = null, t }: SimpleMemoirPageProps) {
  const language = resolveLanguage(rawLanguage);
  const memoir = useMemoir();
  // The question the link asked for, until it is answered; then this week's
  const [requestedId, setRequestedId] = useState(questionId);
  const [justSaved, setJustSaved] = useState(false);
  const overview = memoir.overview;

  const handleAnswer = async (request: AnswerMemoirRequest) => {
    const result = await memoir.answer(request);
    if (!result.data) return false;
    setRequestedId(null);
    setJustSaved(true);
    return true;
  };

  const frame = (heading: string, children: ReactNode, eyebrow?: string) => (
    <section className={`simple-memoir ${theme}`} aria-labelledby={HEADING_ID}>
      {eyebrow && <p className="simple-memoir-eyebrow">{eyebrow}</p>}
      <h1 id={HEADING_ID} className="simple-memoir-heading">{heading}</h1>
      {children}
      <p className="simple-memoir-leave">
        <Link to={getPathForView('memoir')}>{t('memoirSimpleFullApp')}</Link>
      </p>
    </section>
  );

  if (!overview) {
    if (memoir.loadError) {
      return frame(t('memoirSimpleEyebrow'), (
        <div className="simple-memoir-answer" role="alert">
          <p className="simple-memoir-note">{t('memoirLoadError')}</p>
          <button type="button" className="simple-memoir-secondary" onClick={memoir.retry}>
            <span className="codicon codicon-refresh" aria-hidden="true" />
            {t('tryAgain')}
          </button>
        </div>
      ));
    }
    return frame(t('memoirSimpleEyebrow'), (
      <output className="simple-memoir-note">
        <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" /> {t('loading')}
      </output>
    ));
  }

  const program = overview.program;
  if (!program) return frame(t('memoirSimpleEyebrow'), <p className="simple-memoir-note">{t('memoirSimpleNotStarted')}</p>);
  const view = pickSimpleMemoirView(program, overview.chapters, requestedId);
  if (view.kind === 'noDiary') return frame(t('memoirSimpleEyebrow'), <p className="simple-memoir-note" role="alert">{t('memoirSimpleNoDiary')}</p>);

  if (justSaved || view.kind === 'answered') {
    return frame(t('memoirSimpleThanksTitle'), (
      <div className="simple-memoir-answer">
        <p className="simple-memoir-note" role={justSaved ? 'status' : undefined}>
          {justSaved ? t('memoirSimpleSaved') : t('memoirSimpleAnswered')}
        </p>
        <p className="simple-memoir-note">{nextQuestionNote(program, language, t)}</p>
        {justSaved && view.kind === 'ask' && (
          <button type="button" className="simple-memoir-primary" onClick={() => setJustSaved(false)}>
            <span className="codicon codicon-arrow-right" aria-hidden="true" />
            {t('memoirSimpleNextQuestion')}
          </button>
        )}
      </div>
    ), t('memoirSimpleEyebrow'));
  }

  if (view.kind === 'setAside') {
    return frame(t('memoirSimpleEyebrow'), <p className="simple-memoir-note">{t('memoirSimpleSetAside', { date: formatMemoirDay(view.returnDay, language) })}</p>);
  }
  if (view.kind === 'complete') return frame(t('memoirSimpleThanksTitle'), <p className="simple-memoir-note">{t('memoirSimpleComplete')}</p>, t('memoirSimpleEyebrow'));

  return frame(
    localize(view.question.text, language),
    <SimpleMemoirAnswer key={view.question.id} questionId={view.question.id} onSubmit={handleAnswer} t={t} />,
    `${t('memoirSimpleEyebrow')} · ${localize(view.chapter.title, language)}`,
  );
}

export default SimpleMemoirPage;
