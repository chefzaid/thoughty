import { useEffect } from 'react';

import type { Diary, TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import PageHeader from '../PageHeader/PageHeader';
import YearReviewCharts from './YearReviewCharts';
import YearReviewHero from './YearReviewHero';
import YearReviewHighlights from './YearReviewHighlights';
import YearReviewMood from './YearReviewMood';
import YearReviewShare from './YearReviewShare';
import { defaultReviewYear } from './yearReviewFormat';
import { useYearReview } from './useYearReview';
import './YearReviewPage.css';

/** Marks the page while the review is shown, so that its booklet print rules apply to it and nowhere else. */
const ACTIVE_CLASS = 'year-review-active';

export interface YearReviewPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly diaries: Diary[];
  /** The year from the URL, or null to pick one. */
  readonly year: number | null;
  readonly diaryId: number | null;
  readonly onChangeYear: (year: number, options?: { replace?: boolean }) => void;
  readonly onChangeDiary: (diaryId: number | null) => void;
  readonly onOpenEntry: (entryId: number) => void;
  readonly t: TranslationFunction;
}

/** A private look back at one year of writing. */
function YearReviewPage({ theme, language: rawLanguage, diaries, year, diaryId, onChangeYear, onChangeDiary, onOpenEntry, t }: YearReviewPageProps) {
  const language = resolveLanguage(rawLanguage);
  const activeYear = year ?? defaultReviewYear();
  const { review, mood } = useYearReview(activeYear, diaryId);
  const data = review.data;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(ACTIVE_CLASS);
    return () => root.classList.remove(ACTIVE_CLASS);
  }, []);

  // Without a requested year, an empty default year gives way to the latest year with entries
  useEffect(() => {
    const latest = data?.availableYears[0];
    if (year === null && data && data.totals.entries === 0 && latest !== undefined && latest !== activeYear) {
      onChangeYear(latest, { replace: true });
    }
  }, [activeYear, data, onChangeYear, year]);

  const years = [...new Set([activeYear, ...(data?.availableYears ?? [])])].sort((first, second) => second - first);

  let body;
  if (review.isPending) {
    body = <p className="review-state" role="status">{t('reviewLoading')}</p>;
  } else if (review.isError || !data) {
    body = (
      <div className="review-state" role="alert">
        <p>{t('reviewLoadError')}</p>
        <button type="button" className="review-secondary" onClick={() => void review.refetch()}>{t('reviewRetry')}</button>
      </div>
    );
  } else if (data.totals.entries === 0) {
    body = <p className="review-state">{data.availableYears.length === 0 ? t('reviewEmptyJournal') : t('reviewEmptyYear', { year: activeYear })}</p>;
  } else {
    body = (
      <>
        <YearReviewHero review={data} language={language} t={t} />
        <YearReviewCharts review={data} language={language} t={t} />
        <YearReviewHighlights review={data} language={language} onOpenEntry={onOpenEntry} t={t} />
        <YearReviewMood
          mood={data.mood}
          recordedMood={data.recordedMood}
          aiAvailable={data.aiAvailable}
          reading={mood.isPending}
          failed={mood.isError}
          onRead={() => mood.mutate()}
          language={language}
          t={t}
        />
        <YearReviewShare key={`${data.year}-${data.diaryId ?? 'all'}`} review={data} language={language} onOpenEntry={onOpenEntry} t={t} />
      </>
    );
  }

  return (
    <div className={`review-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <PageHeader
        title={t('reviewTitle', { year: activeYear })}
        theme={theme === 'light' ? 'light' : 'dark'}
        actions={(
          <div className="review-filters review-print-hidden">
            <label className="review-field">
              <span>{t('reviewYearLabel')}</span>
              <select value={activeYear} onChange={(event) => onChangeYear(Number(event.target.value))}>
                {years.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="review-field">
              <span>{t('reviewScopeLabel')}</span>
              <select
                value={diaryId ?? 'all'}
                onChange={(event) => onChangeDiary(event.target.value === 'all' ? null : Number(event.target.value))}
              >
                <option value="all">{t('allDiaries')}</option>
                {diaries.map((diary) => <option key={diary.id} value={diary.id}>{diary.name}</option>)}
              </select>
            </label>
          </div>
        )}
      />
      {body}
    </div>
  );
}

export default YearReviewPage;
