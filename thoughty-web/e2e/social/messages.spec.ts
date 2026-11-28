import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockConversation } from '../support/mockApp.routes.messages';
import type { MockEntry } from '../support/mockApp.shared';
import { goToView, navGroupButton } from '../support/navigation';

const publicEntry = (id: number, userId: number, authorUsername: string): MockEntry => ({
  id,
  userId,
  authorUsername,
  date: `2026-07-${String(10 + id).padStart(2, '0')}`,
  index: 1,
  content: `${authorUsername} writes in public`,
  format: 'plain',
  tags: [],
  visibility: 'public',
});

const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-07-01T12:00:00.000Z' });

/** Maya and lena follow the reader back; omar does not. */
const WRITERS = {
  initialEntries: [publicEntry(1, 2, 'maya'), publicEntry(2, 3, 'omar'), publicEntry(3, 4, 'lena')],
  followedUserIds: [2, 3, 4],
  writers: { followers: [writer(2, 'maya'), writer(4, 'lena')] },
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

async function signIn(page: Page, conversations: (readerId: number) => MockConversation[] = () => []) {
  const setup = await setupMockApp(page, { startAuthenticated: true, ...WRITERS });
  setup.state.messages.conversations.push(...conversations(setup.state.user.id));
  setup.state.messages.nextMessageId = 100;
  setup.state.messages.nextConversationId = 20;
  return setup;
}

const axeViolations = async (page: Page, selector: string) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include(selector).analyze())
    .violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));

test.describe('messages', () => {
  test('counts unread messages in the menu, reads them and answers', async ({ page }) => {
    const { state } = await signIn(page, (readerId) => [withMaya(readerId)]);
    await page.goto('/journal');

    const social = navGroupButton(page, 'Social');
    await expect(social).toHaveAccessibleDescription('2 unread messages');
    await social.click();
    const messagesItem = page.getByRole('navigation').getByRole('button', { name: 'Messages', exact: true });
    await expect(messagesItem).toContainText('2');
    await messagesItem.click();
    await expect(page).toHaveURL(/\/messages$/);

    const conversations = page.getByRole('region', { name: 'Conversations' });
    const maya = conversations.getByRole('button', { name: /maya/ });
    await expect(maya).toContainText('Walk on Sunday?');
    await expect(maya).toContainText('2 new');
    // Only the writers who follow the reader back can be written to
    const writeTo = page.getByRole('region', { name: 'Write to' });
    await expect(writeTo.getByRole('button')).toHaveCount(2);
    await expect(writeTo.getByRole('button', { name: 'Write to lena' })).toBeVisible();
    await expect(writeTo.getByRole('button', { name: 'Write to maya' })).toBeVisible();
    expect(await axeViolations(page, '.messages-page')).toEqual([]);

    await maya.click();
    await expect(page).toHaveURL(/\/messages\?conversation=7$/);
    const thread = page.getByRole('region', { name: 'Conversation with maya' });
    await expect(thread.getByRole('log').getByRole('listitem')).toHaveText([
      /Did you see the river this morning\?/,
      /I did! The fog was lovely\./,
      /Walk on Sunday\?/,
    ]);
    await expect.poll(() => state.messages.conversations[0]?.lastReadMessageId).toBe(12);
    await expect(maya).not.toContainText('new');
    await expect(social).not.toHaveAccessibleDescription('2 unread messages');

    const field = thread.getByLabel('Message to maya');
    await field.fill('Sunday at ten, by the bridge.');
    await field.press('Enter');
    await expect(field).toHaveValue('');
    await expect(thread.getByRole('log').getByRole('listitem').last()).toContainText('Sunday at ten, by the bridge.');
    await expect(thread.locator('.messages-bubble.mine').last()).toContainText('Sunday at ten');
    await expect(maya).toContainText('You: Sunday at ten, by the bridge.');
    expect(state.messages.conversations[0]?.messages.at(-1)).toEqual(expect.objectContaining({ senderId: state.user.id, body: 'Sunday at ten, by the bridge.' }));
    expect(await axeViolations(page, '.messages-page')).toEqual([]);
  });

  test('starts a conversation with a writer who follows back', async ({ page }) => {
    const { state } = await signIn(page);
    await page.goto('/journal');
    await goToView(page, 'Messages');

    await expect(page.getByText('No conversations yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Write to lena' }).click();
    await expect(page).toHaveURL(/\/messages\?conversation=20$/);
    const thread = page.getByRole('region', { name: 'Conversation with lena' });
    await expect(thread).toContainText('No messages yet. Say hello to lena.');

    await thread.getByLabel('Message to lena').fill('Hello lena!');
    await thread.getByRole('button', { name: 'Send' }).click();
    await expect(thread.getByRole('log')).toContainText('Hello lena!');
    await expect(page.getByRole('region', { name: 'Conversations' }).getByRole('button', { name: /lena/ })).toContainText('You: Hello lena!');
    expect(state.messages.conversations.map((conversation) => conversation.writer.username)).toEqual(['lena']);

    // Back goes to the list without a conversation open
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(page.getByText('Choose a conversation, or write to someone.')).toBeVisible();
  });

  test('reads a conversation with a writer who no longer follows back, without a field to answer', async ({ page }) => {
    await signIn(page, () => [{
      id: 8,
      writer: { id: 3, username: 'omar', avatarUrl: null },
      lastReadMessageId: 0,
      messages: [{ id: 30, senderId: 3, body: 'Thanks for the book.', createdAt: '2026-11-20T09:00:00.000Z' }],
    }]);
    await page.goto('/messages?conversation=8');

    const thread = page.getByRole('region', { name: 'Conversation with omar' });
    await expect(thread.getByRole('log')).toContainText('Thanks for the book.');
    await expect(thread.getByRole('note')).toHaveText('You no longer follow each other, so you can read this conversation but not answer it.');
    await expect(thread.getByRole('textbox')).toHaveCount(0);
  });

  test('shows the list or the conversation alone on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(page, (readerId) => [withMaya(readerId)]);
    await page.goto('/messages');

    const conversations = page.getByRole('region', { name: 'Conversations' });
    await conversations.getByRole('button', { name: /maya/ }).click();
    const thread = page.getByRole('region', { name: 'Conversation with maya' });
    await expect(thread).toBeVisible();
    await expect(conversations).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await thread.getByRole('button', { name: 'All conversations' }).click();
    await expect(conversations).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conversation with maya' })).toHaveCount(0);
  });

  test('reads in French, in the light theme', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' }, ...WRITERS });
    state.messages.conversations.push(withMaya(state.user.id));
    await page.goto('/journal');
    await goToView(page, 'Messages', 'fr');

    await expect(page.getByRole('heading', { level: 1, name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Écrire à' }).getByRole('button', { name: 'Écrire à maya' })).toBeVisible();
    const maya = page.getByRole('region', { name: 'Conversations' }).getByRole('button', { name: /maya/ });
    await expect(maya).toContainText('2 nouveaux');
    await maya.click();
    const thread = page.getByRole('region', { name: 'Conversation avec maya' });
    await expect(thread.getByLabel('Message à maya')).toBeVisible();
    await expect(thread.locator('.messages-bubble.mine')).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await axeViolations(page, '.messages-page')).toEqual([]);
  });
});
