import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import RecycleBinPage, { type RecycleBinPageProps } from '../components/RecycleBin/RecycleBinPage';
import { getPathForView } from '../types';

type RecycleBinRouteProps = Omit<RecycleBinPageProps, 'page' | 'onChangePage' | 'onBack'>;

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** `/recycle-bin?page=2`; the page is optional. */
function RecycleBinRoute(props: Readonly<RecycleBinRouteProps>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const changePage = useCallback((page: number, options?: { replace?: boolean }) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (page > 1) {
        next.set('page', String(page));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: options?.replace });
  }, [setSearchParams]);

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
