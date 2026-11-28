import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import RecycleBinPage, { type RecycleBinPageProps } from '../components/RecycleBin/RecycleBinPage';
import { useLateSearchParams } from '../hooks/useLateSearchParams';
import { getPathForView } from '../types';

type RecycleBinRouteProps = Omit<RecycleBinPageProps, 'page' | 'onChangePage' | 'onBack'>;

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** `/recycle-bin?page=2`; the page is optional. */
function RecycleBinRoute(props: Readonly<RecycleBinRouteProps>) {
  const navigate = useNavigate();
  const [searchParams, writeSearchParams] = useLateSearchParams();

  const changePage = useCallback((page: number, options?: { replace?: boolean }) => {
    writeSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (page > 1) {
        next.set('page', String(page));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: options?.replace });
  }, [writeSearchParams]);

  return (
    <RecycleBinPage
      {...props}
      page={parsePage(searchParams.get('page'))}
      onChangePage={changePage}
      onBack={() => navigate(getPathForView('journal'))}
    />
  );
}

export default RecycleBinRoute;
