import type { Page } from '@playwright/test';
import { registerMockAppRoutes } from './mockApp.routes';
import { createMockAppState, type SetupMockAppOptions } from './mockApp.shared';

export async function setupMockApp(page: Page, options: SetupMockAppOptions = {}) {
  const state = createMockAppState(options);

  // No tokens are seeded in the page: like the real httpOnly refresh cookie, the mock API's
  // `state.authenticated` decides whether POST /api/auth/refresh returns an access token.
  await registerMockAppRoutes(page, state);

  return {
    state,
  };
}