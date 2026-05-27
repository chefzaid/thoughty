import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useAppRouteState } from './useAppRouteState';

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useAppRouteState', () => {
  it('parses journal route params and permalink state', () => {
    const { result } = renderHook(() => useAppRouteState(), {
      wrapper: createWrapper('/journal?diary=7&entry=42'),
    });

    expect(result.current.currentView).toBe('journal');
    expect(result.current.publicView).toBeNull();
    expect(result.current.routeDiaryId).toBe(7);
    expect(result.current.routeEntryId).toBe(42);
    expect(result.current.diaryReturnView).toBe('journal');
    expect(result.current.importExportSection).toBe('export');
    expect(result.current.importExportFormat).toBe('txt');
    expect(result.current.importExportIncludeVisibility).toBe(false);
  });

  it('detects public routes without private route state', () => {
    const { result } = renderHook(() => useAppRouteState(), {
      wrapper: createWrapper('/login'),
    });

    expect(result.current.currentView).toBeNull();
    expect(result.current.publicView).toBe('login');
    expect(result.current.routeDiaryId).toBeUndefined();
    expect(result.current.routeEntryId).toBeUndefined();
  });

  it('parses import and diary management query state', () => {
    const { result } = renderHook(() => useAppRouteState(), {
      wrapper: createWrapper('/import-export?diary=all&section=import&format=json&includeVisibility=true&from=stats'),
    });

    expect(result.current.currentView).toBe('importExport');
    expect(result.current.routeDiaryId).toBeNull();
    expect(result.current.diaryReturnView).toBe('stats');
    expect(result.current.importExportSection).toBe('import');
    expect(result.current.importExportFormat).toBe('json');
    expect(result.current.importExportIncludeVisibility).toBe(true);
  });
});