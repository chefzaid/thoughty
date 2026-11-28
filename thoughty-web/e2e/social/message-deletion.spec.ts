import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockConversation } from '../support/mockApp.routes.messages';
import { goToView, navGroupButton } from '../support/navigation';

const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-07-01T12:00:00.000Z' });

/** Maya follows the reader back. */
const WRITERS = {
  initialEntries: [{
    id: 1,
    userId: 2,
    authorUsername: 'maya',
    date: '2026-07-11',
    index: 1,
    content: 'maya writes in public',
    format: 'plain' as const,
    tags: [],
    visibility: 'public' as const,
  }],
  followedUserIds: [2],
  writers: { followers: [writer(2, 'maya')] },
};

const withMaya = (readerId: number): MockConversation => ({
  id: 7,
  writer: { id: 2, username: 'maya', avatarUrl: null },
  lastReadMessageId: 11,
  messages: [
    { id: 10, senderId: readerId, body: 'Did you see the river this morning?', createdAt: '2026-11-27T08:00:00.000Z' },
    { id: 11, senderId: 2, body: 'I did! The fog was lovely.', createdAt: '2026-11-27T08:05:00.000Z' },
    { id: 12, senderId: 2, body: 'Walk on Sunday?', createdAt: '2026-11-27T08:06:00.000Z' },
  ],
});

async function openConversation(page: Page, language: 'en' | 'fr' = 'en') {
  const setup = await setupMockApp(page, { startAuthenticated: true, config: { language }, ...WRITERS });
  setup.state.messages.conversations.push(withMaya(setup.state.user.id));
  setup.state.messages.nextMessageId = 100;
  await page.goto('/journal');
  if (language === 'fr') await goToView(page, 'Messages', 'fr');
  else await goToView(page, 'Messages');
  return setup;
}

const axeViolations = async (page: Page, selector: string) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include(selector).analyze())
    .violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));

test.describe('deleting messages for oneself', () => {
  test('deletes one message, once confirmed, from the conversation and its preview', async ({ page }) => {
    const { state } = await openConversation(page);
    const maya = page.getByRole('region', { name: 'Conversations' }).getByRole('button', { name: /maya/ });
    await maya.click();
    const thread = page.getByRole('region', { name: 'Conversation with maya' });
    const bubbles = thread.getByRole('log').getByRole('listitem');
    await expect(bubbles).toHaveCount(3);
    expect(await axeViolations(page, '.messages-page')).toEqual([]);

    const newest = bubbles.filter({ hasText: 'Walk on Sunday?' });
    await newest.getByRole('button', { name: 'Delete this message for you' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this message?' });
    await expect(dialog).toContainText('It leaves your conversation only: maya still has it.');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    expect(await axeViolations(page, '[role="alertdialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(bubbles).toHaveCount(3);

    await newest.getByRole('button', { name: 'Delete this message for you' }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(bubbles).toHaveText([/Did you see the river this morning\?/, /I did! The fog was lovely\./]);
    await expect(maya).toContainText('I did! The fog was lovely.');
    expect(state.messages.conversations[0]?.messages.map((message) => message.id)).toEqual([10, 11]);

    // The reader's own message goes the same way
    await bubbles.filter({ hasText: 'Did you see the river' }).getByRole('button', { name: 'Delete this message for you' }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(bubbles).toHaveText([/I did! The fog was lovely\./]);
  });

  test('deletes the conversation, which comes back with only a newer message', async ({ page }) => {
    const { state } = await openConversation(page);
    const conversations = page.getByRole('region', { name: 'Conversations' });
    await conversations.getByRole('button', { name: /maya/ }).click();
    const thread = page.getByRole('region', { name: 'Conversation with maya' });
    await expect(thread.getByRole('log').getByRole('listitem')).toHaveCount(3);

    await thread.getByRole('button', { name: 'Delete conversation' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this conversation?' });
    await expect(dialog).toContainText('maya still has them. If maya writes again, the conversation comes back with the new messages only.');
    expect(await axeViolations(page, '[role="alertdialog"]')).toEqual([]);
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/messages$/);
    await expect(conversations).toContainText('No conversations yet.');
    await expect(page.getByText('Choose a conversation, or write to someone.')).toBeVisible();

    // Maya writes again: the conversation is back, holding only her new message, unread
    state.messages.conversations[0]?.messages.push({ id: 13, senderId: 2, body: 'Are you there?', createdAt: '2026-11-28T09:00:00.000Z' });
    await page.reload();
    await expect(navGroupButton(page, 'Social')).toHaveAccessibleDescription('1 unread message');
    const maya = conversations.getByRole('button', { name: /maya/ });
    await expect(maya).toContainText('Are you there?');
    await expect(maya).toContainText('1 new');
    await maya.click();
    await expect(thread.getByRole('log').getByRole('listitem')).toHaveText([/Are you there\?/]);
  });

  test('asks in French and fits a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openConversation(page, 'fr');
    await page.getByRole('region', { name: 'Conversations' }).getByRole('button', { name: /maya/ }).click();
    const thread = page.getByRole('region', { name: 'Conversation avec maya' });
    await expect(thread.getByRole('button', { name: 'Supprimer la conversation' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await thread.getByRole('log').getByRole('listitem').first().getByRole('button', { name: 'Supprimer ce message pour vous' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Supprimer ce message ?' });
    await expect(dialog).toContainText('Il disparaît de votre conversation seulement : maya le garde.');
    await dialog.getByRole('button', { name: 'Supprimer' }).click();
    await expect(thread.getByRole('log').getByRole('listitem')).toHaveCount(2);
    expect(await axeViolations(page, '.messages-page')).toEqual([]);
  });
});
