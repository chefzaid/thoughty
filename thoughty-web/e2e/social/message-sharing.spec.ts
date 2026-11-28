import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockConversation } from '../support/mockApp.routes.messages';
import type { MockEntry, SetupMockAppOptions } from '../support/mockApp.shared';

const entry = (id: number, visibility: MockEntry['visibility'], title: string | null, extra: Partial<MockEntry> = {}): MockEntry => ({
  id,
  date: '2026-11-20',
  index: id - 49,
  title,
  content: `${title ?? 'Untitled'} in the journal`,
  format: 'plain',
  tags: [],
  visibility,
  ...extra,
});
const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-07-01T12:00:00.000Z' });

/** The reader follows maya and omar, who write in public; maya follows back, omar does not, so only maya can be written to. */
const SOCIAL = {
  followedUserIds: [2, 3],
  theirEntries: [
    entry(60, 'public', 'Maya in public', { userId: 2, authorUsername: 'maya', date: '2026-07-10', index: 1 }),
    entry(61, 'public', 'Omar in public', { userId: 3, authorUsername: 'omar', date: '2026-07-11', index: 1 }),
  ],
  writers: { followers: [writer(2, 'maya')] },
};

const withMaya = (readerId: number): MockConversation => ({
  id: 7,
  writer: { id: 2, username: 'maya', avatarUrl: null },
  lastReadMessageId: 10,
  messages: [
    { id: 10, senderId: readerId, body: 'Did you see the river this morning?', createdAt: '2026-11-27T08:00:00.000Z' },
    { id: 11, senderId: 2, body: 'I did! The fog was lovely.', createdAt: '2026-11-27T08:05:00.000Z' },
    { id: 12, senderId: 2, body: 'Walk on Sunday?', createdAt: '2026-11-27T08:06:00.000Z' },
  ],
});

async function signIn(page: Page, options: Partial<SetupMockAppOptions> = {}, conversations: (readerId: number) => MockConversation[] = () => []) {
  const setup = await setupMockApp(page, {
    startAuthenticated: true,
    initialEntries: [entry(50, 'public', 'River walk'), entry(51, 'private', null), ...SOCIAL.theirEntries],
    followedUserIds: SOCIAL.followedUserIds,
    writers: SOCIAL.writers,
    ...options,
  });
  setup.state.messages.conversations.push(...conversations(setup.state.user.id));
  setup.state.messages.nextMessageId = 100;
  setup.state.messages.nextConversationId = 20;
  return setup;
}

const axeViolations = async (page: Page, selector: string) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include(selector).analyze())
    .violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));

test.describe('messages in notifications and shared entries', () => {
  test('a burst of messages is one notification that opens the conversation and goes once it is read', async ({ page }) => {
    await signIn(page, {}, (readerId) => [withMaya(readerId)]);
    await page.goto('/journal');

    const bell = page.getByRole('button', { name: 'Notifications, 1 new' });
    await expect(bell.locator('.nav-notifications-badge')).toHaveText('1');
    await bell.click();
    const panel = page.getByRole('region', { name: 'Notifications', exact: true });
    const item = panel.getByRole('button', { name: /maya sent you 2 messages/ });
    await expect(item).toContainText('Walk on Sunday?');
    await expect(panel.getByRole('listitem')).toHaveCount(1);
    expect(await axeViolations(page, '.nav-notifications')).toEqual([]);

    await item.click();
    await expect(page).toHaveURL(/\/messages\?conversation=7$/);
    const thread = page.getByRole('region', { name: 'Conversation with maya' });
    await expect(thread.getByRole('log')).toContainText('Walk on Sunday?');

    // Read now, so the bell has nothing more about it
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await expect(panel.getByText(/Nothing yet/)).toBeVisible();
  });

  test('says only that a writer wrote in quiet mode, and in French', async ({ page }) => {
    await signIn(page, { config: { quietMode: true, language: 'fr' } }, (readerId) => [withMaya(readerId)]);
    await page.goto('/journal');

    await page.getByRole('button', { name: 'Notifications, du nouveau' }).click();
    const item = page.getByRole('region', { name: 'Notifications', exact: true }).getByRole('button', { name: /maya vous a écrit/ });
    await expect(item).toContainText('Walk on Sunday?');
    await expect(item).not.toContainText('messages');
  });

  test('Discuss › With someone shares a public entry with a writer who follows back and opens the conversation', async ({ page }) => {
    const { state } = await signIn(page);
    await page.goto('/journal');

    const card = page.locator('#entry-50');
    await card.getByRole('button', { name: 'Discuss this entry' }).click();
    const menu = card.getByRole('menu', { name: 'Discuss this entry' });
    await expect(menu.getByRole('menuitem')).toHaveText(['With AI', 'With someone']);
    await menu.getByRole('menuitem', { name: 'Discuss with someone' }).click();

    const dialog = page.getByRole('dialog', { name: 'Discuss with someone' });
    await expect(dialog).toContainText('Only a public entry can be shared');
    await expect(dialog.getByLabel('Your message')).toBeFocused();
    await expect(dialog.getByRole('radio')).toHaveCount(1);
    expect(await axeViolations(page, '[role="dialog"]')).toEqual([]);

    await dialog.getByLabel('Your message').fill('This one made me think of you');
    await dialog.getByRole('radio', { name: 'maya' }).check();
    await dialog.getByRole('button', { name: 'Send and open the conversation' }).click();

    await expect(page).toHaveURL(/\/messages\?conversation=20$/);
    const bubble = page.getByRole('region', { name: 'Conversation with maya' }).getByRole('listitem');
    await expect(bubble).toContainText('This one made me think of you');
    await expect(bubble).toContainText('Shared entry: “River walk”');
    expect(state.messages.conversations[0]?.messages[0]).toEqual(expect.objectContaining({ entryId: 50 }));
    expect(await axeViolations(page, '.messages-page')).toEqual([]);

    await bubble.getByRole('link', { name: 'Open in the feed' }).click();
    await expect(page).toHaveURL(/\/feed\?entry=50$/);
    await expect(page.locator('.feed-entry')).toContainText('River walk in the journal');
  });

  test('a private entry is not shared, only explained, and with AI off Discuss offers only a writer', async ({ page }) => {
    await signIn(page, { featureFlags: { ai: false } });
    await page.goto('/journal');

    const card = page.locator('#entry-51');
    await expect(card.getByRole('button', { name: 'Discuss this entry' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Discuss with someone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Discuss with someone' });
    await expect(dialog.getByRole('note')).toHaveText('This entry is private. Make it public first to share it in a message.');
    await expect(dialog.getByLabel('Your message')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Discuss with someone' })).toBeFocused();
  });

  test('the conversation says when a shared entry is no longer public', async ({ page }) => {
    await signIn(page, {}, (readerId) => [{
      ...withMaya(readerId),
      lastReadMessageId: 13,
      messages: [{ id: 13, senderId: readerId, body: 'Read this', createdAt: '2026-11-27T09:00:00.000Z', entryId: 51 }],
    }]);
    await page.goto('/messages?conversation=7');

    const bubble = page.getByRole('region', { name: 'Conversation with maya' }).getByRole('listitem');
    await expect(bubble).toContainText('The entry shared here is no longer public.');
    await expect(bubble.getByRole('link')).toHaveCount(0);
  });
});
