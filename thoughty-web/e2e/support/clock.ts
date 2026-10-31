import type { Page } from '@playwright/test';

/**
 * Stops the page's clock a second from now. `page.clock.install()` alone lets time keep flowing in
 * real time, so on a busy machine a countdown or a hide-after delay has moved on by the time it is
 * checked. After this call nothing time-based moves until the test calls `page.clock.runFor(...)`.
 * Install the clock before navigating, and pause once the page has loaded, before the action whose
 * timing the test checks. `pauseAt` cannot go back in time, hence the second ahead.
 */
export async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}
