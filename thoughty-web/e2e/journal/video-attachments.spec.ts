import { truncate, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_WEBM } from '../support/mockVideo';

const clip = { name: 'harbour.webm', mimeType: 'video/webm', buffer: MOCK_WEBM };

const axe = async (page: Parameters<typeof setupMockApp>[0]) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test.describe('Video attachments', () => {
  test('attaches a video with a poster frame drawn in the browser, and plays it in place only when asked', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    const composer = page.locator('form').first();
    await page.locator('input[type="file"]').first().setInputFiles([clip]);
    // The picked file plays from the browser before it is uploaded
    await expect(composer.locator('video')).toHaveAttribute('src', /^blob:/);
    await expect(composer.getByText('Video · 759 B')).toBeVisible();
    await composer.getByPlaceholder("What's on your mind?").fill('Boats leaving the harbour.');
    await composer.locator('input[placeholder="tags..."]').fill('sea');
    await composer.locator('input[placeholder="tags..."]').press('Enter');

    const posterUpload = page.waitForRequest((request) => /\/api\/attachments\/\d+\/poster$/.test(request.url()));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const sentPoster = (await posterUpload).postDataBuffer()!;
    // A JPEG drawn from the video's frame, sent as the poster's file
    expect(sentPoster.includes(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    await expect.poll(() => state.entries.find((entry) => entry.content === 'Boats leaving the harbour.')?.attachments?.[0]?.poster_filename)
      .toMatch(/^poster-\d+\.jpg$/);

    // The video is fetched only once the reader presses play
    const videoRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/attachments\/file\/stored-\d+$/.test(request.url())) videoRequests.push(request.url());
    });
    await page.reload();
    const play = page.getByRole('button', { name: 'Play the video harbour.webm' });
    await expect(play.locator('img')).toHaveAttribute('src', /^blob:/);
    expect(videoRequests).toEqual([]);
    expect(await axe(page)).toEqual([]);

    await play.click();
    const player = page.locator('video');
    await expect(player).toHaveAttribute('src', /^blob:/);
    await expect(player).toHaveAttribute('poster', /^blob:/);
    await expect(player).toHaveAttribute('controls', '');
    expect(videoRequests).toHaveLength(1);
    await expect.poll(() => player.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThan(0);
    await expect(page.getByText('This browser cannot play this video.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Download attachment' })).toHaveAttribute('download', 'harbour.webm');
    expect(await axe(page)).toEqual([]);
  });

  test('turns away a video over 50 MB before uploading it, in French', async ({ page }, testInfo) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');
    // Too large to pass as a buffer: a sparse file of the size
    const path = testInfo.outputPath('long.mov');
    await writeFile(path, '');
    await truncate(path, (50 * 1024 * 1024) + 1);

    await page.locator('input[type="file"]').first().setInputFiles(path);

    await expect(page.getByRole('alert')).toContainText('long.mov : La vidéo est trop volumineuse. Taille maximale : 50 Mo.');
  });
});
