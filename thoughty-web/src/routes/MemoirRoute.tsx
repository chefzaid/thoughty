import { useNavigate, useSearchParams } from 'react-router-dom';

import MemoirPage, { type MemoirPageProps } from '../components/MemoirPage/MemoirPage';
import { getPathForView } from '../types';
import { buildDiaryRouteSearchParams, ENTRY_PERMALINK_PARAM, toSearchString } from '../utils/appRouting';
import Redirect from './Redirect';

type MemoirRouteProps = Omit<MemoirPageProps, 'initialQuestionId' | 'onOpenEntry' | 'onOpenBook' | 'onOpenSimpleMode'>;

/**
 * `/memoir?question=<id>` (the weekly email link) opens that question's answer form, or, in simple
 * mode, that question on the simple screen; the full app's own links carry no question and stay here.
 */
function MemoirRoute(props: Readonly<MemoirRouteProps>) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const questionId = searchParams.get('question');

  if (props.simpleMode && questionId) {
    return <Redirect to={`${getPathForView('memoirSimple')}${toSearchString(new URLSearchParams({ question: questionId }))}`} replace />;
  }

  return (
    <MemoirPage
      {...props}
      initialQuestionId={questionId}
      onOpenEntry={(entryId) => navigate(`${getPathForView('journal')}?${ENTRY_PERMALINK_PARAM}=${entryId}`)}
      onOpenBook={(diaryId) => navigate(
        `${getPathForView('importExport')}${toSearchString(buildDiaryRouteSearchParams('importExport', diaryId, { importExportSection: 'book' }))}`,
      )}
      onOpenSimpleMode={() => navigate(getPathForView('memoirSimple'))}
    />
  );
}

export default MemoirRoute;
