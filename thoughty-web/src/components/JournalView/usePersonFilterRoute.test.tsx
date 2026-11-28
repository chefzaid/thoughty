import { StrictMode, useState, type Dispatch, type SetStateAction } from 'react';
import { act, render, screen } from '@testing-library/react';
import { Route, Routes, UNSAFE_createMemoryHistory, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { MemoryHistory } from '../../test/lateNavigation';
import { usePersonFilterRoute } from './usePersonFilterRoute';

const otherSetters = {
  setSearch: vi.fn(), setSearchMode: vi.fn(), setSearchSort: vi.fn(), setFilterTags: vi.fn(), setFilterDateObj: vi.fn(),
  setFilterVisibility: vi.fn(), setFilterFavorites: vi.fn(), setFilterArchiveStatus: vi.fn(), setFilterMood: vi.fn(),
  setFilterEraId: vi.fn(),
};

let choosePerson: Dispatch<SetStateAction<number | null>> = () => undefined;

function Journal() {
  const [filterPersonId, setFilterPersonId] = useState<number | null>(null);
  choosePerson = setFilterPersonId;
  usePersonFilterRoute({ ...otherSetters, filterPersonId, setFilterPersonId });
  return <output>{`person ${filterPersonId ?? 'none'}`}</output>;
}

function renderAt(address: string): { history: MemoryHistory; replace: ReturnType<typeof vi.spyOn> } {
  const history = UNSAFE_createMemoryHistory({ initialEntries: [address], v5Compat: true });
  const replace = vi.spyOn(history, 'replace');
  render(
    <StrictMode>
      <HistoryRouter history={history}>
        <Routes>
          <Route path="/journal" element={<Journal />} />
          <Route path="/import-export" element={<p>Book converter</p>} />
        </Routes>
      </HistoryRouter>
    </StrictMode>,
  );
  return { history, replace };
}

const address = (history: MemoryHistory) => `${history.location.pathname}${history.location.search}`;

describe('usePersonFilterRoute', () => {
  it('opens a person’s link without writing the address, even when React runs the effect twice', async () => {
    const { history, replace } = renderAt('/journal?diary=all&person=1');
    await act(async () => {});

    expect(screen.getByText('person 1')).toBeVisible();
    // Strict Mode's second run used to read the person just asked for as cleared: `person` left the
    // address, then came back with a late write that could land after the writer had moved on
    expect(replace).not.toHaveBeenCalled();
    expect(address(history)).toBe('/journal?diary=all&person=1');
  });

  it('writes a person chosen in the filter bar, and their clearing, to the address', async () => {
    const { history } = renderAt('/journal?diary=all');
    await act(async () => {});

    await act(async () => choosePerson(4));
    expect(address(history)).toBe('/journal?diary=all&person=4');
    await act(async () => choosePerson(null));
    expect(address(history)).toBe('/journal?diary=all');
    expect(screen.getByText('person none')).toBeVisible();
  });

  it('does not take the writer back when the filter changes as they leave for another page', async () => {
    const { history } = renderAt('/journal?diary=all&person=1');
    await act(async () => {});

    // The journal is still on screen while the new address renders (a transition), so its effects still run
    await act(async () => {
      history.push('/import-export?section=book');
      choosePerson(null);
    });

    expect(address(history)).toBe('/import-export?section=book');
    expect(screen.getByText('Book converter')).toBeVisible();
  });
});
