import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REQUIRED_FEATURE_KEY } from './common/feature-flags/require-feature.decorator';
import { listHandlers, operationOf } from './route-handlers.test-helpers';

interface OpenApiTestDocument {
  paths: Record<string, Record<string, { responses?: Record<string, { description?: string }> }>>;
}

const document = JSON.parse(
  readFileSync(join(__dirname, '../openapi/openapi.json'), 'utf8'),
) as OpenApiTestDocument;

/** How `@RequireFeature(flag)` documents its 503. */
const REQUIRED_FEATURE = /^FEATURE_DISABLED: the `(\w+)` feature is turned off/;

/**
 * The web e2e mock API (`thoughty-web/e2e/support/mockApp.feature-flags.ts`) refuses a switched-off
 * feature's routes by reading this document, so each `@RequireFeature` route must be in it as exported.
 */
describe('feature flag routes', () => {
  const decorated = listHandlers()
    .flatMap((route) => {
      const flag = (Reflect.getMetadata(REQUIRED_FEATURE_KEY, route.handler) ??
        Reflect.getMetadata(REQUIRED_FEATURE_KEY, route.controller)) as string | undefined;
      return flag ? [`${flag} ${operationOf(route)}`] : [];
    })
    .sort();

  const documented = Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).flatMap(([method, operation]) => {
        const flag = REQUIRED_FEATURE.exec(operation.responses?.['503']?.description ?? '')?.[1];
        return flag ? [`${flag} ${method.toUpperCase()} ${path}`] : [];
      }),
    )
    .sort();

  it('finds the routes closed by a flag, at the controller and the method level', () => {
    expect(decorated).toEqual(
      expect.arrayContaining([
        'ai POST /api/entries/chat',
        'ai POST /api/review/week',
        'publicSharing GET /api/entries/feed',
        'publicSharing PUT /api/writers/{userId}/mute',
      ]),
    );
    expect(decorated).not.toContain('ai GET /api/ai/credentials');
  });

  it('documents in openapi.json exactly the routes `@RequireFeature` closes (run `npm run api:sync`)', () => {
    expect(documented).toEqual(decorated);
  });
});
