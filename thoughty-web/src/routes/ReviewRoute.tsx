import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import YearReviewPage, { type YearReviewPageProps } from '../components/YearReview/YearReviewPage';
import { getPathForView } from '../types';
import { ENTRY_PERMALINK_PARAM } from '../utils/appRouting';

type ReviewRouteProps = Omit<YearReviewPageProps, 'year' | 'diaryId' | 'onChangeYear' | 'onChangeDiary' | 'onOpenEntry'>;

function parseYear(value: string | null): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

function parseDiary(value: string | null): number | null {
  const diaryId = Number(value);
  return Number.isInteger(diaryId) && diaryId > 0 ? diaryId : null;
}

/** `/review?year=2025&diary=3`; both are optional. */
function ReviewRoute(props: Readonly<ReviewRouteProps>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const update = useCallback((key: 'year' | 'diary', value: number | null, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace });
  }, [setSearchParams]);
  const changeYear = useCallback(
    (year: number, options?: { replace?: boolean }) => update('year', year, options?.replace),
    [update],
  );

  return (
    <YearReviewPage
      {...props}
      year={parseYear(searchParams.get('year'))}
      diaryId={parseDiary(searchParams.get('diary'))}
      onChangeYear={changeYear}
      onChangeDiary={(diaryId) => update('diary', diaryId)}
      onOpenEntry={(entryId) => navigate(`${getPathForView('journal')}?${ENTRY_PERMALINK_PARAM}=${entryId}`)}
    />
  );
}

export default ReviewRoute;
