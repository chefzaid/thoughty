import { useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createEntriesService, type YearReview } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { formatEntryDate } from '../../utils/entryDate';
import type { Language } from '../../utils/translations';
import { buildShareText } from './yearReviewFormat';

interface YearReviewShareProps {
  readonly review: YearReview;
  readonly language: Language;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

type ShareState = { step: 'closed' } | { step: 'editing'; failed: boolean } | { step: 'posting' } | { step: 'posted'; entryId?: number };

/** Keeps the review private, or posts a short summary the writer has read and edited; also prints it as a booklet. */
function YearReviewShare({ review, language, onOpenEntry, t }: YearReviewShareProps) {
  const entriesService = useAuthenticatedService(createEntriesService);
  const [state, setState] = useState<ShareState>({ step: 'closed' });
  const [includeThemes, setIncludeThemes] = useState(false);
  const [text, setText] = useState(() => buildShareText(review, language, t, false));

  const toggleThemes = (checked: boolean) => {
    setIncludeThemes(checked);
    setText(buildShareText(review, language, t, checked));
  };

  const post = async () => {
    setState({ step: 'posting' });
    const result = await entriesService.createEntry({
      text: text.trim(),
      tags: [],
      date: formatEntryDate(new Date()),
      visibility: 'public',
      format: 'plain',
      diaryId: null,
    });
    setState(result.success ? { step: 'posted', entryId: result.entryId } : { step: 'editing', failed: true });
  };

  return (
    <section className="review-card review-print-hidden" aria-labelledby="review-share-heading">
      <h2 id="review-share-heading">{t('reviewShareTitle')}</h2>
      <p className="review-note">{t('reviewPrivateNote')}</p>

      {(state.step === 'editing' || state.step === 'posting') && (
        <form
          className="review-share-form"
          onSubmit={(event) => {
            event.preventDefault();
            void post();
          }}
        >
          <label htmlFor="review-share-text" className="review-label">{t('reviewShareLabel')}</label>
          <textarea id="review-share-text" value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} />
          <label className="review-checkbox">
            <input type="checkbox" checked={includeThemes} onChange={(event) => toggleThemes(event.target.checked)} />
            {t('reviewShareIncludeThemes')}
          </label>
          <p className="review-note">{t('reviewShareHint')}</p>
          {state.step === 'editing' && state.failed && <p className="review-error" role="alert">{t('reviewShareError')}</p>}
          <div className="review-actions">
            <button type="submit" className="review-primary" disabled={state.step === 'posting' || !text.trim()}>
              {state.step === 'posting' ? t('reviewSharePosting') : t('reviewSharePost')}
            </button>
            <button type="button" className="review-secondary" disabled={state.step === 'posting'} onClick={() => setState({ step: 'closed' })}>
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {state.step === 'posted' && (
        <div className="review-actions" role="status">
          <p className="review-success">{t('reviewSharePosted')}</p>
          {state.entryId !== undefined && (
            <button type="button" className="review-link" onClick={() => onOpenEntry(state.entryId as number)}>
              {t('reviewShareOpen')}
            </button>
          )}
        </div>
      )}

      {state.step === 'closed' && (
        <div className="review-actions">
          <button type="button" className="review-primary" onClick={() => setState({ step: 'editing', failed: false })}>
            {t('reviewShareAction')}
          </button>
          <button type="button" className="review-secondary" onClick={() => globalThis.print()}>
            {t('reviewPrint')}
          </button>
        </div>
      )}
    </section>
  );
}

export default YearReviewShare;
