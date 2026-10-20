import type { YearReview, YearReviewHighlight } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import './YearReviewHighlights.css';

const KIND_KEYS: Record<YearReviewHighlight['kind'], string> = {
  first: 'reviewHighlightFirst',
  favorite: 'reviewHighlightFavorite',
  longest: 'reviewHighlightLongest',
  last: 'reviewHighlightLast',
};

interface YearReviewHighlightsProps {
  readonly review: YearReview;
  readonly language: Language;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

/** Themes of the year, then the entries worth reopening. */
function YearReviewHighlights({ review, language, onOpenEntry, t }: YearReviewHighlightsProps) {
  const formatDay = (date: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

  return (
    <>
      <section className="review-card" aria-labelledby="review-themes-heading">
        <h2 id="review-themes-heading">{t('reviewThemesTitle')}</h2>
        {review.topTags.length === 0 ? (
          <p className="review-note">{t('reviewThemesEmpty')}</p>
        ) : (
          <ul className="review-tags">
            {review.topTags.map(({ tag, count }) => (
              <li key={tag}>
                <span className="review-tag-name">{tag}</span>
                <span className="review-tag-count">{count.toLocaleString(language)}</span>
              </li>
            ))}
          </ul>
        )}
        {review.newTags.length > 0 && (
          <>
            <h3 className="review-subheading">{t('reviewNewTags')}</h3>
            <ul className="review-tags review-tags-new">
              {review.newTags.map((tag) => <li key={tag}><span className="review-tag-name">{tag}</span></li>)}
            </ul>
          </>
        )}
      </section>

      {review.highlights.length > 0 && (
        <section className="review-card" aria-labelledby="review-highlights-heading">
          <h2 id="review-highlights-heading">{t('reviewHighlightsTitle')}</h2>
          <div className="review-highlights">
            {review.highlights.map((highlight) => (
              <article key={`${highlight.kind}-${highlight.entryId}`} className="review-highlight" aria-labelledby={`review-highlight-${highlight.entryId}`}>
                <h3 id={`review-highlight-${highlight.entryId}`}>{t(KIND_KEYS[highlight.kind])}</h3>
                <p className="review-highlight-date">{formatDay(highlight.date)}</p>
                <p className="review-highlight-excerpt">{highlight.excerpt}</p>
                <button type="button" className="review-link" onClick={() => onOpenEntry(highlight.entryId)}>
                  {t('reviewReadEntry')}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default YearReviewHighlights;
