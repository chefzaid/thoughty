import { act, render } from '@testing-library/react';
import { Route, Routes, UNSAFE_createMemoryHistory, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useLateSearchParams, type WriteSearchParams } from './useLateSearchParams';

let write: WriteSearchParams = () => false;
let shown = '';

function Page() {
  const [searchParams, writeSearchParams] = useLateSearchParams();
  write = writeSearchParams;
  shown = searchParams.toString();
  return null;
}

function renderAt(address: string) {
  const history = UNSAFE_createMemoryHistory({ initialEntries: [address], v5Compat: true });
  render(
    <HistoryRouter history={history}>
      <Routes>
        <Route path="/journal" element={<Page />} />
      </Routes>
    </HistoryRouter>,
  );
  return history;
}

describe('useLateSearchParams', () => {
  it('writes the address the page shows, as React Router does', async () => {
    const history = renderAt('/journal?diary=2');

    let written = false;
    await act(async () => {
      written = write((previous) => new URLSearchParams({ diary: previous.get('diary') ?? '', page: '3' }), { replace: true });
    });

    expect(written).toBe(true);
    expect(`${history.location.pathname}${history.location.search}`).toBe('/journal?diary=2&page=3');
    expect(history.action).toBe('REPLACE');
    expect(shown).toBe('diary=2&page=3');
  });

  it('does nothing once the writer has moved on, so a late write cannot take them back', async () => {
    const history = renderAt('/journal?diary=2');
    // The page that rendered is left, but still on screen, as while a navigation's transition renders
    const lateWrite = write;
    history.push('/import-export?section=book');

    let written = true;
    await act(async () => {
      written = lateWrite({ diary: '2', person: '1' }, { replace: true });
    });

    expect(written).toBe(false);
    expect(`${history.location.pathname}${history.location.search}`).toBe('/import-export?section=book');
  });

  it('does nothing either when only the query string moved on', async () => {
    const history = renderAt('/journal?diary=2');
    const lateWrite = write;
    history.push('/journal?diary=3');

    await act(async () => {
      expect(lateWrite({ diary: '2', page: '2' })).toBe(false);
    });

    expect(history.location.search).toBe('?diary=3');
  });
});
