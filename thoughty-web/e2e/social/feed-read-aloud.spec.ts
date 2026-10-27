import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';

interface SpokenUtterance {
  text: string;
  lang: string;
  voice: string | null;
}

/** 11 community entries: the feed loads 10 per page, so reading on from the end needs the second page. */
const communityEntries = Array.from({ length: 11 }, (_, index) => ({
  id: index + 10,
  userId: 2,
  authorUsername: `Writer${index + 1}`,
  date: `2026-07-${String(20 - index).padStart(2, '0')}`,
  index: 1,
  content: index === 1
    ? "Aujourd'hui je suis allée à la mer avec mes amis"
    : `This is the community entry number ${index + 1}`,
  tags: [],
  visibility: 'public' as const,
  createdAt: `2026-07-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`,
}));

/** Replaces the browser's speech synthesis with one that records what it is asked to say. */
async function stubSpeechSynthesis(page: Page) {
  await page.addInitScript(() => {
    const spoken: Array<{ text: string; lang: string; voice: string | null; onend: (() => void) | null }> = [];
    const testWindow = window as unknown as Record<string, unknown>;
    testWindow.__speech = { spoken, cancels: 0 };
    const voices = [
      { voiceURI: 'english-voice', name: 'English', lang: 'en-US', default: true, localService: true },
      { voiceURI: 'french-voice', name: 'French', lang: 'fr-FR', default: false, localService: true },
    ];
    class FakeUtterance {
      text: string;
      lang = '';
      voice: { voiceURI: string } | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: FakeUtterance) => spoken.push({
          text: utterance.text,
          lang: utterance.lang,
          voice: utterance.voice?.voiceURI ?? null,
          onend: () => utterance.onend?.(),
        }),
        cancel: () => {
          (testWindow.__speech as { cancels: number }).cancels += 1;
        },
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

async function spokenUtterances(page: Page): Promise<SpokenUtterance[]> {
  return page.evaluate(() => {
    const speech = (window as unknown as { __speech: { spoken: SpokenUtterance[] } }).__speech;
    return speech.spoken.map(({ text, lang, voice }) => ({ text, lang, voice }));
  });
}

/** Ends the utterance being spoken, as the browser does when it finishes reading it. */
async function finishSpeaking(page: Page) {
  await page.evaluate(() => {
    const speech = (window as unknown as { __speech: { spoken: Array<{ onend: () => void }> } }).__speech;
    speech.spoken.at(-1)?.onend();
  });
}

test.describe('reading the feed aloud', () => {
  test.beforeEach(async ({ page }) => {
    await stubSpeechSynthesis(page);
    await setupMockApp(page, { startAuthenticated: true, config: { readDates: false }, initialEntries: communityEntries });
  });

  test('reads one entry in its own language', async ({ page }) => {
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Listen to the entry by Writer2' }).click();
    await page.getByRole('menuitem', { name: 'Read this entry' }).click();

    await expect.poll(() => spokenUtterances(page)).toEqual([
      { text: "Aujourd'hui je suis allée à la mer avec mes amis", lang: 'fr-FR', voice: 'french-voice' },
    ]);
    await expect(page.getByRole('button', { name: 'Stop listening', pressed: true })).toHaveCount(1);

    await finishSpeaking(page);
    await expect(page.getByRole('button', { name: 'Listen to the entry by Writer2' })).toHaveAttribute('aria-pressed', 'false');
    expect(await spokenUtterances(page)).toHaveLength(1);
  });

  test('reads on in order into the next page and stops when asked', async ({ page }) => {
    await page.goto('/feed');

    const trigger = page.getByRole('button', { name: 'Listen to the entry by Writer9' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Read this entry' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await spokenUtterances(page)).length).toBe(1);
    await finishSpeaking(page);
    await expect.poll(async () => (await spokenUtterances(page)).length).toBe(2);
    await finishSpeaking(page);
    await expect.poll(async () => (await spokenUtterances(page)).length).toBe(3);
    await expect(page.getByText('This is the community entry number 11')).toBeVisible();

    expect((await spokenUtterances(page)).map(({ text, lang }) => [text, lang])).toEqual([
      ['This is the community entry number 9', 'en-US'],
      ['This is the community entry number 10', 'en-US'],
      ['This is the community entry number 11', 'en-US'],
    ]);
    await expect(page.locator('article.feed-entry.reading')).toContainText('This is the community entry number 11');

    await page.getByRole('button', { name: 'Stop listening', pressed: true }).click();
    await expect(page.getByRole('button', { name: 'Stop listening' })).toHaveCount(0);
    await finishSpeaking(page);
    expect(await spokenUtterances(page)).toHaveLength(3);
  });

  test('stops reading when leaving the feed', async ({ page }) => {
    await page.goto('/feed');

    await page.getByRole('button', { name: 'Listen to the entry by Writer1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Read from here onwards' }).click();
    await expect.poll(async () => (await spokenUtterances(page)).length).toBe(1);

    const cancelsBefore = await page.evaluate(() => (window as unknown as { __speech: { cancels: number } }).__speech.cancels);
    await page.getByRole('button', { name: 'Leaderboard' }).click();
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __speech: { cancels: number } }).__speech.cancels))
      .toBeGreaterThan(cancelsBefore);

    await finishSpeaking(page);
    expect(await spokenUtterances(page)).toHaveLength(1);
  });
});
