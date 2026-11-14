import { expect, test, type Locator, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { goToView } from '../support/navigation';

/**
 * Where a spinner's center sits, relative to its parent's center, at five points of its turn (the
 * animation is paused at each). A spinner that turns in place keeps the same center all the way round.
 */
function centersThroughTurn(spinner: Locator) {
  return spinner.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    const duration = Number(animation.effect?.getComputedTiming().duration);
    const parent = element.parentElement!.getBoundingClientRect();
    return [0, 0.25, 0.5, 0.75, 0.99].map((part) => {
      animation.currentTime = part * duration;
      const box = element.getBoundingClientRect();
      return [
        Math.round(box.x + box.width / 2 - (parent.x + parent.width / 2)),
        Math.round(box.y + box.height / 2 - (parent.y + parent.height / 2)),
      ];
    });
  });
}

const animationName = (spinner: Locator) => spinner.evaluate((element) => getComputedStyle(element).animationName);

/** Opens the profile and starts a picture upload that stays in progress, so its spinner stays up. */
async function startPictureUpload(page: Page) {
  await setupMockApp(page, { startAuthenticated: true });
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Change profile picture' })).toBeVisible();
  // The picture is read in the browser; a reader that never finishes keeps the upload going
  await page.evaluate(() => {
    FileReader.prototype.readAsDataURL = () => undefined;
  });
  await page.locator('.hidden-file-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  const spinner = page.locator('.upload-spinner');
  await expect(spinner).toBeVisible();
  return spinner;
}

test.describe('loading spinners', () => {
  test('turn in place, over the profile picture and on a page opened after the profile', async ({ page }) => {
    const upload = await startPictureUpload(page);
    expect(await animationName(upload)).toBe('spin');
    expect(await centersThroughTurn(upload)).toEqual(Array(5).fill([0, 0]));

    // The profile's stylesheet stays loaded: the Stats spinner still turns about its own center
    await page.route('http://localhost:5173/api/stats?**', () => new Promise<void>(() => undefined));
    await goToView(page, 'Stats');
    const stats = page.locator('.stats-loading .spinner');
    await expect(stats).toBeVisible();
    expect(await animationName(stats)).toBe('spin');
    const centers = await centersThroughTurn(stats);
    expect(centers).toEqual(Array(5).fill(centers[0]));
  });

  test('fade in place instead of turning when the system asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const upload = await startPictureUpload(page);
    expect(await animationName(upload)).toBe('motion-loader-fade');
    expect(await centersThroughTurn(upload)).toEqual(Array(5).fill([0, 0]));
  });
});
