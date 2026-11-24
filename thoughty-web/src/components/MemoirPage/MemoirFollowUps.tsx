import { useId, useState } from 'react';

import { useLocalAiService } from '../../hooks/useLocalAiService';
import { useMemoirService } from '../../hooks/useMemoirService';
import type { TranslationFunction } from '../../types';
import AiSparkleIcon from '../AiSparkleIcon/AiSparkleIcon';
import { confirmAiRequest, consentDetails } from '../DiaryAi/aiConsent';
import { useRequestAiConsent } from '../DiaryAi/aiConsentContext';
import type { DiaryAiMode } from '../../utils/diaryAi';
import './MemoirFollowUps.css';

/** The API takes back at most this many follow-ups already offered, the most recent ones. */
const MAX_ASKED = 12;

type FollowUpsStatus = 'idle' | 'asking' | 'none';

interface MemoirFollowUpsProps {
  readonly questionId: string;
  /** The question in the writer's language, which the AI reads with the answer. */
  readonly questionText: string;
  /** The answer written so far. */
  readonly answer: string;
  /** Puts a follow-up at the end of the answer for the writer to answer below it. */
  readonly onUse: (question: string) => void;
  readonly disabled?: boolean;
  /**
   * The memoir diary's AI mode: asking each time, each round shows the writer what it sends first; on the
   * writer's own model, each round goes to that model from this browser.
   */
  readonly aiMode?: DiaryAiMode;
  readonly t: TranslationFunction;
}

/**
 * Memoir interview mode: follow-up questions the AI asks about the answer being written, grounded only in its words.
 * Each round asks for questions other than those already offered for this answer; nothing is kept.
 */
function MemoirFollowUps({ questionId, questionText, answer, onUse, disabled = false, aiMode = 'on', t }: MemoirFollowUpsProps) {
  const service = useMemoirService();
  const localAiService = useLocalAiService();
  const requestConsent = useRequestAiConsent();
  const [questions, setQuestions] = useState<readonly string[]>([]);
  const [asked, setAsked] = useState<readonly string[]>([]);
  const [status, setStatus] = useState<FollowUpsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const hintId = useId();
  const listId = useId();
  const empty = !answer.trim();
  const asking = status === 'asking';

  /** The questions, from the writer's own model in a memoir diary set to it, else from Thoughty's server. */
  const requestFollowUps = async (sentAsked: readonly string[], aiConsent: true | undefined) => {
    if (aiMode === 'local') {
      const { data, refusal } = await localAiService.memoirFollowUps({ question: questionText, answer, asked: sentAsked });
      return { questions: data, failure: refusal };
    }
    const { data, error: failure } = await service.followUps({
      questionId,
      text: answer,
      asked: [...sentAsked],
      ...(aiConsent ? { aiConsent: true } : {}),
    });
    return { questions: data?.questions ?? null, failure };
  };

  const ask = async () => {
    if (empty || asking || disabled) return;
    setStatus('asking');
    setError(null);
    setAdded(false);
    const sentAsked = asked.slice(-MAX_ASKED);
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      text: answer,
      details: consentDetails([
        { label: 'aiConsentQuestion', value: questionText },
        { label: 'aiConsentAskedBefore', value: sentAsked.join('\n') },
      ]),
      task: 'prompt',
    });
    if (!consent.send) {
      setStatus('idle');
      return;
    }
    const { questions: offered, failure } = await requestFollowUps(sentAsked, consent.aiConsent);
    if (!offered) {
      setStatus('idle');
      setError(failure ?? 'memoirFollowUpsError');
      return;
    }
    setQuestions(offered);
    setAsked((previous) => [...previous, ...offered]);
    setStatus(offered.length > 0 ? 'idle' : 'none');
  };

  const use = (question: string) => {
    setQuestions((previous) => previous.filter((item) => item !== question));
    setAdded(true);
    onUse(question);
  };

  return (
    <div className="memoir-follow-ups" role="group" aria-labelledby={`${hintId}-title`}>
      <p id={`${hintId}-title`} className="memoir-follow-ups-title">
        <AiSparkleIcon />
        {t('memoirFollowUpsTitle')}
      </p>
      <p id={hintId} className="memoir-hint">{t(empty ? 'memoirFollowUpsNeedText' : 'memoirFollowUpsHint')}</p>
      <button
        type="button"
        className="memoir-secondary"
        aria-describedby={hintId}
        aria-disabled={empty || undefined}
        aria-busy={asking || undefined}
        disabled={disabled || asking}
        onClick={() => void ask()}
      >
        {t(asking ? 'memoirFollowUpsAsking' : asked.length > 0 ? 'memoirFollowUpsAskMore' : 'memoirFollowUpsAsk')}
      </button>

      {questions.length > 0 && (
        <>
          <p id={listId} className="memoir-follow-ups-list-title">{t('memoirFollowUpsList')}</p>
          <ul className="memoir-follow-ups-list" aria-labelledby={listId}>
            {questions.map((question) => (
              <li key={question}>
                <span className="privacy-text">{question}</span>
                <button
                  type="button"
                  className="memoir-secondary"
                  aria-label={t('memoirFollowUpsUseLabel', { question })}
                  disabled={disabled}
                  onClick={() => use(question)}
                >
                  {t('memoirFollowUpsUse')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="sr-only" role="status">{added ? t('memoirFollowUpsAdded') : ''}</p>
      {status === 'none' && <p className="memoir-hint" role="status">{t('memoirFollowUpsNone')}</p>}
      {error && <p className="memoir-error" role="alert">{t(error)}</p>}
    </div>
  );
}

export default MemoirFollowUps;
