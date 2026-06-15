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
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    browserName: 'chromium',
    channel: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
