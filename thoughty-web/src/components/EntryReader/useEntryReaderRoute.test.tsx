import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useEntryReaderRoute } from './useEntryReaderRoute';

function renderRoute(search: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/journal${search}`]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ route: useEntryReaderRoute(), location: useLocation(), navigation: useNavigationType() }), { wrapper });
}

describe('useEntryReaderRoute', () => {
  it('is closed without a read address', () => {
    const { result } = renderRoute('?diary=2');
    expect(result.current.route).toMatchObject({ isOpen: false, entryId: null, scope: '' });
  });

  it('opens on a scope at its first entry as a new history step, then turns pages and closes in place', () => {
    const { result } = renderRoute('?diary=2&layout=calendar');

    act(() => result.current.route.open('tags=walks&page=3&month=2026-10'));
    expect(result.current.location.search).toBe('?diary=2&layout=calendar&read=first&readIn=tags%3Dwalks%26month%3D2026-10');
    expect(result.current.navigation).toBe('PUSH');
    expect(result.current.route).toMatchObject({ isOpen: true, entryId: null, scope: 'tags=walks&month=2026-10' });

    act(() => result.current.route.show(42));
    expect(result.current.location.search).toBe('?diary=2&layout=calendar&read=42&readIn=tags%3Dwalks%26month%3D2026-10');
    expect(result.current.navigation).toBe('REPLACE');
    expect(result.current.route.entryId).toBe(42);

    act(() => result.current.route.show(null));
    expect(result.current.route).toMatchObject({ isOpen: true, entryId: null });

    act(() => result.current.route.close());
    expect(result.current.location.search).toBe('?diary=2&layout=calendar');
    expect(result.current.route.isOpen).toBe(false);
  });

  it('opens a scope at a chosen entry', () => {
    const { result } = renderRoute('?diary=2');

    act(() => result.current.route.open('ids=11%2C12', 12));
    expect(result.current.location.search).toBe('?diary=2&read=12&readIn=ids%3D11%252C12');
    expect(result.current.navigation).toBe('PUSH');
    expect(result.current.route).toMatchObject({ isOpen: true, entryId: 12, scope: 'ids=11%2C12' });
  });

  it('reads the whole journal without a scope, and opens the first entry for an ID that is not one', () => {
    const { result } = renderRoute('?read=abc&readIn=evil%3D1');
    expect(result.current.route).toMatchObject({ isOpen: true, entryId: null, scope: '' });

    act(() => result.current.route.open(''));
    expect(result.current.location.search).toBe('?read=first');
  });
});
