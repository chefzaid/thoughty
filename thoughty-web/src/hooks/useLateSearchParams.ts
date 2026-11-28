import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useSearchParams, type SetURLSearchParams } from 'react-router-dom';

/** Writes the page's query string, as React Router's setter does; false when it was not written. */
export type WriteSearchParams = (...args: Parameters<SetURLSearchParams>) => boolean;

interface HistoryLocation {
  readonly pathname: string;
  readonly search: string;
}

/** Where the history is now: the browser and memory histories know; another navigator cannot tell. */
function historyLocation(navigator: object): HistoryLocation | null {
  return 'location' in navigator ? navigator.location as HistoryLocation : null;
}

/**
 * React Router's `useSearchParams`, for a page that writes its address by itself once something has
 * loaded or settled (a filter read from the address, a saved search, a page number past the end), not
 * only on the writer's click. Location updates are transitions: when the writer has just gone to another
 * page, the page they left stays on screen and its effects keep running a moment longer, and React
 * Router's setter navigates from the address that page rendered, so such a late write would take the
 * writer back to it. This setter writes only while the history is still at the address this render
 * read, and does nothing once the writer has moved on.
 */
export function useLateSearchParams(): [URLSearchParams, WriteSearchParams] {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname, search } = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const write = useCallback<WriteSearchParams>((next, options) => {
    const current = historyLocation(navigator);
    if (current && (current.pathname !== pathname || current.search !== search)) return false;
    setSearchParams(next, options);
    return true;
  }, [navigator, pathname, search, setSearchParams]);

  return [searchParams, write];
}
