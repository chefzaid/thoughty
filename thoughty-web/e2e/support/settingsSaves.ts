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

/**
 * Makes every settings read (`GET /api/config`) fail with a server error, while saves still reach the mock API.
 * Returns how many saves were sent so far.
 */
export async function failSettingsReads(page: Page) {
  let saves = 0;
  await page.route('http://localhost:5173/api/config', async (route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { statusCode: 500, message: 'Internal server error' }, { status: 500 });
      return;
    }
    saves += 1;
    await route.fallback();
  });
  return { saves: () => saves };
}
