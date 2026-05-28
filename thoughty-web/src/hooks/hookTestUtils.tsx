import { renderHook as rtlRenderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { createTestQueryClient } from '../test/queryClient';

function createQueryClientWrapper() {
  const queryClient = createTestQueryClient();

  return function QueryClientWrapper({ children }: Readonly<{ children: ReactNode }>) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

export function renderHook<TResult>(callback: () => TResult) {
  return rtlRenderHook(callback, { wrapper: createQueryClientWrapper() });
}