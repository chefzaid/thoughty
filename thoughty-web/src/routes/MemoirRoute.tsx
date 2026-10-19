import { useNavigate, useSearchParams } from 'react-router-dom';

import MemoirPage, { type MemoirPageProps } from '../components/MemoirPage/MemoirPage';
import { getPathForView } from '../types';
import { buildDiaryRouteSearchParams, ENTRY_PERMALINK_PARAM, toSearchString } from '../utils/appRouting';

type MemoirRouteProps = Omit<MemoirPageProps, 'initialQuestionId' | 'onOpenEntry' | 'onOpenBook'>;

/** `/memoir?question=<id>` (the weekly email link) opens that question's answer form. */
function MemoirRoute(props: Readonly<MemoirRouteProps>) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return (
    <MemoirPage
      {...props}
      initialQuestionId={searchParams.get('question')}
      onOpenEntry={(entryId) => navigate(`${getPathForView('journal')}?${ENTRY_PERMALINK_PARAM}=${entryId}`)}
      onOpenBook={(diaryId) => navigate(
        `${getPathForView('importExport')}${toSearchString(buildDiaryRouteSearchParams('importExport', diaryId, { importExportSection: 'book' }))}`,
      )}
    />
  );
}

export default MemoirRoute;
