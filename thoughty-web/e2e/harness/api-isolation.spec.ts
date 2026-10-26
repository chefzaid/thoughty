import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

// The last test reads what the first two sent, so they share one worker and run in order.
test.describe.configure({ mode: 'serial' });

test.describe('e2e API isolation', () => {
  const received: string[] = [];
  let server: http.Server;
  let apiOrigin = '';

  test.beforeAll(async () => {
    server = http.createServer((request, response) => {
      received.push(`${request.method} ${request.url}`);
      response.writeHead(200, { 'access-control-allow-origin': '*' }).end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    apiOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('answers an /api request no mock route handles with 503 instead of proxying it', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');
    await page.unrouteAll();

    const sameOrigin = await page.evaluate(async () => {
      const response = await fetch('/api/config');
      return { status: response.status, body: (await response.json()) as { message?: string } };
    });
    expect(sameOrigin).toEqual({ status: 503, body: { message: 'No e2e mock answers GET /api/config' } });

    const otherOrigin = await page.evaluate(async (url) => (await fetch(url)).status, `${apiOrigin}/api/stats`);
    expect(otherOrigin).toBe(503);
  });

  test('ends with a request still waiting on its route handler', async ({ page }) => {
    await setupMockApp(page);
    let markHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      markHeld = resolve;
    });
    // Never answers: when the test ends, the request is still waiting on this handler.
    await page.route(`${apiOrigin}/api/**`, () => {
      markHeld();
      return new Promise<void>(() => undefined);
    });
    await page.goto('/');

    await page.evaluate((url) => {
      void fetch(url).catch(() => undefined);
    }, `${apiOrigin}/api/entries/1/backlinks`);
    await held;
  });

  test('lets neither request reach the network', () => {
    expect(received).toEqual([]);
  });
});
