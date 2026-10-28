import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';

import type { MockEntry } from '../support/mockApp.shared';
import { setupMockApp } from '../support/mockApp';
import { buildMockBookPdf } from '../support/mockBookPdf';
import { MOCK_WEBM } from '../support/mockVideo';

const THEMES = ['dark', 'light'] as const;

// One entry with a card of every attachment kind: a picture, a voice note, a video, a PDF, a text
// file, and a file with no inline preview.
const ENTRIES: MockEntry[] = [
  {
    id: 71,
    date: '2026-10-21',
    index: 1,
    content: 'Everything from the harbor trip.',
    tags: ['trip'],
    visibility: 'private',
    diaryId: 1,
    attachments: [
      { id: 701, original_filename: 'harbor.png', stored_filename: 'stored-harbor.png', mimetype: 'image/png', size: 68 },
      { id: 702, original_filename: 'gulls.mp3', stored_filename: 'stored-gulls.mp3', mimetype: 'audio/mpeg', size: 8192 },
      { id: 703, original_filename: 'boats.webm', stored_filename: 'stored-boats.webm', mimetype: 'video/webm', size: MOCK_WEBM.length },
      { id: 704, original_filename: 'tickets.pdf', stored_filename: 'stored-tickets.pdf', mimetype: 'application/pdf', size: 20480 },
      { id: 705, original_filename: 'packing.txt', stored_filename: 'stored-packing.txt', mimetype: 'text/plain', size: 42 },
      { id: 706, original_filename: 'route.gpx', stored_filename: 'stored-route.gpx', mimetype: 'application/gpx+xml', size: 3072 },
    ],
  },
];

const TICKETS_PDF = buildMockBookPdf({
  title: 'Ferry tickets',
  author: 'Harbor Lines',
  includeToc: false,
  chapters: [{ title: 'Outbound', paragraphs: ['Departs at 08:15 from pier 3.'] }],
});

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(({ help, id, impact, nodes }) => ({
    help,
    id,
    impact,
    nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));

  expect(violations).toEqual([]);
}

test.describe('attachment cards accessibility', () => {
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const highContrast of [false, true]) {
      const mode = `${theme}${highContrast ? ' high contrast' : ''}`;

      test(`${mode} cards of every attachment kind, a playing video, and the preview dialog`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme, highContrast }, initialEntries: ENTRIES });
        // Real bytes for the video, the PDF and the text file; the other stored files are the mock's small picture
        await page.route('**/api/attachments/file/stored-boats.webm', (route) => route.fulfill({ status: 200, contentType: 'video/webm', body: MOCK_WEBM }));
        await page.route('**/api/attachments/file/stored-tickets.pdf', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: TICKETS_PDF }));
        await page.route('**/api/attachments/file/stored-packing.txt', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Rain jacket, ferry tickets, camera.' }));
        await page.goto('/journal');

        const entry = page.locator('#entry-71');
        await expect(entry.getByRole('img', { name: 'harbor.png' })).toBeVisible();
        await expect(entry.getByLabel('gulls.mp3', { exact: true })).toBeVisible();
        await expect(entry.getByRole('button', { name: 'Play the video boats.webm' })).toBeVisible();
        await expect(entry.getByTitle('tickets.pdf')).toBeVisible();
        await expect(entry.getByTitle('packing.txt')).toBeVisible();
        await expect(entry.getByText('Audio · 8.0 KB')).toBeVisible();
        await expect(entry.getByText('(3.0 KB)')).toBeVisible();
        await expectNoAccessibilityViolations(page);

        await entry.getByRole('button', { name: 'Play the video boats.webm' }).click();
        await expect(entry.getByLabel('boats.webm', { exact: true })).toHaveAttribute('src', /^blob:/);
        await expectNoAccessibilityViolations(page);

        await entry.getByRole('button', { name: 'Preview tickets.pdf' }).click();
        const dialog = page.getByRole('dialog', { name: 'Preview tickets.pdf' });
        await expect(dialog.getByText('PDF · 20.0 KB')).toBeVisible();
        await expectNoAccessibilityViolations(page);
      });
    }
  }
});
