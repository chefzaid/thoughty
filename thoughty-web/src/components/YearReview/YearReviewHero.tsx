import type { YearReview } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatChange } from './yearReviewFormat';

interface YearReviewHeroProps {
  readonly review: YearReview;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** The year in numbers, compared with the year before when it has entries. */
function YearReviewHero({ review, language, t }: YearReviewHeroProps) {
  const { totals, previousYear } = review;
  const stats: Array<{ labelKey: string; value: number; previous?: number }> = [
    { labelKey: 'reviewStatEntries', value: totals.entries, previous: previousYear?.entries },
    { labelKey: 'reviewStatWords', value: totals.words, previous: previousYear?.words },
    { labelKey: 'reviewStatDays', value: totals.writingDays, previous: previousYear?.writingDays },
    { labelKey: 'reviewStatStreak', value: totals.longestStreak },
    { labelKey: 'reviewStatFavorites', value: totals.favorites },
    { labelKey: 'reviewStatFiles', value: totals.attachments },
  ];

  return (
    <section className="review-card review-hero">
      <dl className="review-stats">
        {stats.map(({ labelKey, value, previous }) => (
          <div key={labelKey} className="review-stat">
            <dt>{t(labelKey)}</dt>
            <dd className="review-stat-value">{value.toLocaleString(language)}</dd>
            {previous !== undefined && (
              <dd className="review-change">
                {t('reviewCompared', { change: formatChange(value, previous, language), year: review.year - 1 })}
              </dd>
            )}
          </div>
        ))}
      </dl>
      <p className="review-note">{t('reviewAverageWords', { count: totals.averageWords.toLocaleString(language) })}</p>
    </section>
  );
}

export default YearReviewHero;
