import { defineConfig } from '@playwright/test';

const isCi = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI,
);

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi
    ? [
        ['list'],
        ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
        ['html', { open: 'never' }],
      ]
    : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    browserName: 'chromium',
    channel: 'chromium',
    // A failed test keeps its trace: DOM snapshots before and after each action, network, console and sources.
    // Not the screencast filmstrip, which costs each browser a frame stream for the whole test: with more
    // workers than cores a fresh worker's page load took 9.8s with it and 6.3s without (docs/testing.md).
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
