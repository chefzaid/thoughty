import { expect, test } from '../support/test';
import { featureGatedOperations, requiredFeature, writersDayPlacement } from '../support/mockApp.contract';
import { MOCK_FEATURE_FLAGS } from '../support/mockApp.feature-flags';
import { setupMockApp } from '../support/mockApp';

const TODAY = '2026-11-01';
const ALL_OFF = Object.fromEntries(MOCK_FEATURE_FLAGS.map((flag) => [flag, false]));

// The mock refuses what the API's `@RequireFeature` closes, read from openapi.json, which the server's
// `feature-flag-routes.spec.ts` holds to the decorators: a route closed there cannot be missed here.
test.describe('Mock API feature flags', () => {
  test('reads the flag each route needs from the contract, at the controller and the method level', () => {
    expect(requiredFeature('POST', '/api/entries/chat')).toBe('ai');
    expect(requiredFeature('POST', '/api/review/week')).toBe('ai');
    expect(requiredFeature('PUT', '/api/ai/credentials')).toBe('ai');
    expect(requiredFeature('GET', '/api/ai/credentials')).toBeNull();
    expect(requiredFeature('POST', '/api/cloud-sync/disconnect')).toBeNull();
    expect(requiredFeature('GET', '/api/entries/feed')).toBe('publicSharing');
    expect(requiredFeature('PUT', '/api/entries/12/save')).toBe('publicSharing');
    expect(requiredFeature('GET', '/api/entries/12')).toBeNull();
  });

  test('knows every flag the API closes routes with', () => {
    const flags = new Set(featureGatedOperations().map(({ flag }) => flag));

    expect([...flags].sort()).toEqual([...MOCK_FEATURE_FLAGS].sort());
  });

  test('refuses every route closed by a switched-off flag with the API\'s error', async ({ page }) => {
    // Each request as the app sends it: with the writer's day where the route takes one
    const operations = featureGatedOperations().map(({ flag, method, path }) => {
      const pathname = path.replaceAll(/\{[^}]+\}/g, '1');
      const placement = writersDayPlacement(method, pathname);
      return {
        flag,
        method,
        pathname,
        url: placement === 'query' ? `${pathname}?today=${TODAY}` : pathname,
        body: placement === 'body' ? JSON.stringify({ today: TODAY }) : undefined,
      };
    });
    const { state } = await setupMockApp(page, { startAuthenticated: true, featureFlags: ALL_OFF });
    await page.goto('/');

    const answers = await page.evaluate((requests) => Promise.all(requests.map(async ({ method, url, body }) => {
      const response = await fetch(url, { method, body, headers: body ? { 'Content-Type': 'application/json' } : {} });
      return { status: response.status, body: await response.json() as unknown };
    })), operations);

    expect(answers).toEqual(operations.map(({ flag }) => ({
      status: 503,
      body: { statusCode: 503, message: `The ${flag} feature is turned off for now`, error: 'Service Unavailable', code: 'FEATURE_DISABLED' },
    })));
    // Sent at once, so they arrive in any order
    expect([...state.featureDisabledRequests].sort()).toEqual(operations.map(({ method, pathname }) => `${method} ${pathname}`).sort());
  });
});
