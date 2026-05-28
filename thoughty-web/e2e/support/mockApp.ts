import type { Page } from '@playwright/test';
import { registerMockAppRoutes } from './mockApp.routes';
import { createMockAppState, type MockEntry, type SetupMockAppOptions } from './mockApp.shared';

export type { MockEntry } from './mockApp.shared';

export async function setupMockApp(page: Page, options: SetupMockAppOptions = {}) {
  const state = createMockAppState(options);

  await page.addInitScript((authenticated: boolean) => {
    if (authenticated) {
      localStorage.setItem('accessToken', 'test-access-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      return;
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, state.authenticated);

  await registerMockAppRoutes(page, state);

  return {
    state,
  };
}