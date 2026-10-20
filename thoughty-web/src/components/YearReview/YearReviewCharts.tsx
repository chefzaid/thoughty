import type { YearReview } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { monthName, weekdayName } from '../../utils/calendarNames';
import type { Language } from '../../utils/translations';
import { busiestIndex, countPhrase } from './yearReviewFormat';

interface YearReviewChartsProps {
  readonly review: YearReview;
  readonly language: Language;
  readonly t: TranslationFunction;
}

function barSize(value: number, max: number): string {
  return `${max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0}%`;
}

/** Entries per month and per weekday as simple bars, each read out in full to screen readers. */
function YearReviewCharts({ review, language, t }: YearReviewChartsProps) {
  const monthCounts = review.months.map((month) => month.entries);
  const busiestMonth = busiestIndex(monthCounts);
  const maxMonth = Math.max(...monthCounts);
  const busiestWeekday = busiestIndex(review.weekdays);
  const maxWeekday = Math.max(...review.weekdays);
  // Weekdays arrive Monday first; weekdayName counts from Sunday
  const weekday = (index: number) => weekdayName((index + 1) % 7, language);

  return (
    <div className="review-grid">
      <section className="review-card" aria-labelledby="review-months-heading">
        <h2 id="review-months-heading">{t('reviewMonthsTitle')}</h2>
        {busiestMonth >= 0 && (
          <p className="review-note">
            {t('reviewBusiestMonth', {
              month: monthName(busiestMonth + 1, language),
              entries: countPhrase(t, 'reviewEntries', monthCounts[busiestMonth] ?? 0, language),
            })}
          </p>
        )}
        <ol className="review-columns">
          {review.months.map((month) => (
            <li key={month.month}>
              <span className="review-column-track" aria-hidden="true">
                <span className="review-column" style={{ height: barSize(month.entries, maxMonth) }} />
              </span>
              <span className="review-column-label" aria-hidden="true">{monthName(month.month, language, 'short')}</span>
              <span className="sr-only">
                {t('reviewMonthBar', {
                  month: monthName(month.month, language),
                  entries: countPhrase(t, 'reviewEntries', month.entries, language),
                  words: countPhrase(t, 'reviewWords', month.words, language),
                })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="review-card" aria-labelledby="review-rhythm-heading">
        <h2 id="review-rhythm-heading">{t('reviewRhythmTitle')}</h2>
        {busiestWeekday >= 0 && <p className="review-note">{t('reviewBusiestWeekday', { weekday: weekday(busiestWeekday) })}</p>}
        <ol className="review-rows">
          {review.weekdays.map((count, index) => (
            <li key={weekday(index)}>
              <span className="review-row-label" aria-hidden="true">{weekday(index)}</span>
              <span className="review-row-track" aria-hidden="true">
                <span className="review-row" style={{ width: barSize(count, maxWeekday) }} />
              </span>
              <span className="review-row-count" aria-hidden="true">{count.toLocaleString(language)}</span>
              <span className="sr-only">
                {t('reviewWeekdayBar', { weekday: weekday(index), entries: countPhrase(t, 'reviewEntries', count, language) })}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default YearReviewCharts;
