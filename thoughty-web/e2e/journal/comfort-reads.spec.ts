import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const TODAY = '2026-10-27';

const entry = (id: number, date: string, content: string, fields: Partial<MockEntry> = {}): MockEntry => ({
  id, date, index: 1, content, tags: [], visibility: 'private', diaryId: 1, ...fields,
});

// Three entries to offer (a favorite, a gratitude tag, a French one), and several never to offer
const ENTRIES: MockEntry[] = [
  entry(901, '2025-06-14', 'We swam before anyone else was up.', { is_favorite: true, title: 'The lake' }),
  entry(902, '2025-07-02', 'Soup from Lea, still warm.', { tags: ['Gratitude'] }),
  entry(903, '2025-08-09', 'Un café offert par un inconnu.', { tags: ['reconnaissance'] }),
  entry(904, '2025-09-01', 'Errands in town.', { tags: ['chores'] }),
  entry(905, '2025-10-12', 'Letter to my future self.', {
    is_favorite: true,
    capsule: { openAt: '2031-01-01T09:00:00.000Z', sealedAt: '2025-10-12T09:00:00.000Z', openedAt: null },
  }),
];
const OFFERED = ['June 14, 2025', 'July 2, 2025', 'August 9, 2025'];

const card = (page: Page, name = 'A few pages you once held close') => page.getByRole('region', { name });

async function openJournal(page: Page, options: Parameters<typeof setupMockApp>[1] = {}) {
  const mock = await setupMockApp(page, { startAuthenticated: true, initialEntries: ENTRIES, ...options });
  await page.clock.setFixedTime(new Date(`${TODAY}T20:00:00`));
  await page.goto('/journal');
  await expect(page.locator('#entry-904')).toBeVisible();
  return mock;
}

/** Writes and saves an entry in the composer with a mood, in English or French. */
async function writeEntry(page: Page, text: string, mood: string, fr = false) {
  const form = page.locator('form').first();
  await page.getByPlaceholder(fr ? "Qu'avez-vous à l'esprit ?" : "What's on your mind?").fill(text);
  const tags = form.locator('input[placeholder="tags..."]');
  await tags.fill('days');
  await tags.press('Enter');
  await form.getByRole('group', { name: fr ? 'Humeur (facultative)' : 'Mood (optional)' }).getByText(mood, { exact: true }).click();
  await page.getByRole('button', { name: fr ? 'Enregistrer' : 'Save', exact: true }).click();
}

/** Counts the comfort reads requests the page sends, and gives the queries. */
function watchRequests(page: Page): URLSearchParams[] {
  const queries: URLSearchParams[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/entries/comfort-reads') queries.push(url.searchParams);
  });
  return queries;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('[data-testid="comfort-reads"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Comfort reads after a very low mood', () => {
  test('offers favorites and gratitude entries after a very low mood, without taking focus, and reads one', async ({ page }) => {
    const requests = watchRequests(page);
    const { state } = await openJournal(page);

    await writeEntry(page, 'A heavy, grey day.', 'Very low');
    const offer = card(page);
    await expect(offer).toBeVisible();
    const saved = state.entries.find((candidate) => candidate.content === 'A heavy, grey day.');
    expect(requests.map((query) => query.get('excludeId'))).toEqual([String(saved?.id)]);
    await expect(page.locator('[role="status"]', { hasText: 'A few pages you once held close' })).toHaveText(
      "A few pages you once held close If you'd like, here are entries you kept as favorites or wrote with gratitude.",
    );
    // Never the entry just written, an ordinary one, or a sealed capsule
    const picks = offer.getByRole('listitem');
    await expect(picks).toHaveCount(3);
    for (const day of OFFERED) await expect(offer.getByRole('button', { name: new RegExp(day) })).toBeVisible();
    await expect(offer).not.toContainText(/heavy, grey|Errands|future self/);
    expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="comfort-reads"]') ?? null)).toBeNull();
    // The excerpts blur with the privacy blur, the days and titles stay
    await expect(offer.locator('.privacy-text')).toHaveCount(3);
    expect(await axe(page)).toEqual([]);

    await offer.getByRole('button', { name: /June 14, 2025 · The lake/ }).click();
    const reader = page.getByRole('dialog', { name: 'Reader' });
    await expect(reader.getByText('We swam before anyone else was up.')).toBeVisible();
    await expect(page).toHaveURL(/[?&]read=901(&|$)/);
    // The reader turns through the entries offered only
    await expect(reader.locator('[aria-live="polite"]')).toHaveText('Entry 1 of 3, June 14, 2025.');
    await page.keyboard.press('Escape');
    await expect(reader).toHaveCount(0);
    await expect(offer).toBeVisible();
    await expect(offer.getByRole('button', { name: /June 14, 2025/ })).toBeFocused();
  });

  test('offers nothing after another mood, nor when there is nothing to offer', async ({ page }) => {
    const requests = watchRequests(page);
    await openJournal(page, { initialEntries: ENTRIES.slice(3) });

    await writeEntry(page, 'A quiet, middling day.', 'Low');
    await expect(page.locator('[id^="entry-"]', { hasText: 'A quiet, middling day.' })).toBeVisible();
    expect(requests).toHaveLength(0);

    await writeEntry(page, 'Nothing feels right.', 'Very low');
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.locator('[id^="entry-"]', { hasText: 'Nothing feels right.' })).toBeVisible();
    await expect(page.getByTestId('comfort-reads')).toHaveCount(0);
    await expect(page.locator('[role="status"]', { hasText: 'once held close' })).toHaveCount(0);
  });

  test('offers once a day, and "Not now" or Escape puts it away', async ({ page }) => {
    const requests = watchRequests(page);
    await openJournal(page);

    await writeEntry(page, 'First hard moment.', 'Very low');
    await expect(card(page)).toBeVisible();
    await card(page).getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByTestId('comfort-reads')).toHaveCount(0);

    // Later the same day: no second offer, even after a reload
    await page.reload();
    await writeEntry(page, 'Second hard moment.', 'Very low');
    await expect(page.locator('[id^="entry-"]', { hasText: 'Second hard moment.' })).toBeVisible();
    expect(requests).toHaveLength(1);
    await expect(page.getByTestId('comfort-reads')).toHaveCount(0);

    // The next day it is offered again, and Escape puts it away
    await page.clock.setFixedTime(new Date('2026-10-28T08:00:00'));
    await writeEntry(page, 'A rough morning.', 'Very low');
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('comfort-reads')).toHaveCount(0);
  });

  test('never offers once turned off in Profile', async ({ page }) => {
    const requests = watchRequests(page);
    const { state } = await openJournal(page, { config: { comfortReads: false } });

    await writeEntry(page, 'A heavy day.', 'Very low');
    await expect(page.locator('[id^="entry-"]', { hasText: 'A heavy day.' })).toBeVisible();
    expect(requests).toHaveLength(0);

    await page.goto('/profile');
    const toggle = page.getByRole('switch', { name: 'Gentle rereads on hard days' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => state.config.comfortReads).toBe(true);
  });

  test('speaks French', async ({ page }) => {
    await openJournal(page, { config: { language: 'fr' } });

    await writeEntry(page, 'Une journée lourde.', 'Très basse', true);
    const offer = card(page, 'Quelques pages qui vous sont chères');
    await expect(offer).toContainText('Si le cœur vous en dit, voici des entrées que vous avez gardées en favori ou écrites avec gratitude.');
    await expect(offer.getByRole('button', { name: /14 juin 2025 · The lake/ })).toBeVisible();
    await expect(offer.getByRole('button', { name: /2 juillet 2025 · Entrée sans titre/ })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await offer.getByRole('button', { name: 'Pas maintenant' }).click();
    await expect(page.getByTestId('comfort-reads')).toHaveCount(0);
  });
});
