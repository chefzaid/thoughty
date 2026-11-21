import { useNavigate } from 'react-router-dom';

import WelcomePage, { type WelcomePageProps } from '../components/Welcome/WelcomePage';
import { getPathForView, type ViewType } from '../types';
import { buildDiaryRouteSearchParams, toSearchString } from '../utils/appRouting';

type WelcomeRouteProps = Omit<WelcomePageProps, 'onOpenJournal' | 'onOpenMemoir' | 'onOpenImport'>;

/** `/welcome`: each way out replaces the page in the history, so going back never asks again. */
function WelcomeRoute(props: Readonly<WelcomeRouteProps>) {
  const navigate = useNavigate();
  const defaultDiaryId = props.diaries.find((diary) => diary.isDefault)?.id ?? null;
  const open = (view: ViewType) => navigate({
    pathname: getPathForView(view),
    search: toSearchString(buildDiaryRouteSearchParams(view, defaultDiaryId, { importExportSection: 'import' })),
  }, { replace: true });

  return (
    <WelcomePage
      {...props}
      onOpenJournal={() => open('journal')}
      onOpenMemoir={() => open('memoir')}
      onOpenImport={() => open('importExport')}
    />
  );
}

export default WelcomeRoute;
