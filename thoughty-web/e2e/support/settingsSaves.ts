import type { Page } from '@playwright/test';
import { fulfillJson } from './mockApp.route-utils';

/**
 * Makes every settings save (`POST /api/config`) fail the way the API or the network can, while reading
 * settings still works. Returns how many saves were refused so far.
 */
export async function failSettingsSaves(page: Page, failure: 'status' | 'network') {
  let refusedSaves = 0;
  await page.route('http://localhost:5173/api/config', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    refusedSaves += 1;
    if (failure === 'network') {
      await route.abort('connectionrefused');
      return;
    }
    await fulfillJson(route, { statusCode: 400, message: ['theme must be light or dark'], error: 'Bad Request' }, { status: 400 });
  });
  return { refusedSaves: () => refusedSaves };
}
