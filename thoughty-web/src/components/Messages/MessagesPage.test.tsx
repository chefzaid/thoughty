import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage, Conversation } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import { QuietModeContext } from '../QuietMode/quietMode';
import MessagesPage from './MessagesPage';

const services = {
  list: vi.fn(),
  countUnread: vi.fn(),
  open: vi.fn(),
  thread: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
  fetchFollows: vi.fn(),
};

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => services,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-11-01T08:00:00.000Z' });
const message = (id: number, body: string, mine = false): ChatMessage => ({
  id,
  conversationId: 7,
  senderId: mine ? 1 : 2,
  mine,
  body,
  createdAt: '2026-11-28T08:30:00.000Z',
});
const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 7,
  writer: { id: 2, username: 'maya', avatarUrl: null },
  lastMessage: message(30, 'See you Sunday'),
  unreadCount: 2,
  canWrite: true,
  ...overrides,
});

/** A conversation in the list, by its writer's name. */
const conversationButton = async (username: string) =>
  within(await screen.findByRole('region', { name: 'Conversations' })).findByRole('button', { name: new RegExp(username) });

function renderPage(conversationId: number | null = null, { quiet = false } = {}) {
  const onOpenConversation = vi.fn();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <QuietModeContext.Provider value={quiet}>
        <MessagesPage language="en" conversationId={conversationId} onOpenConversation={onOpenConversation} t={t} />
      </QuietModeContext.Provider>
    </QueryClientProvider>,
  );
  return { onOpenConversation };
}

describe('MessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.list.mockResolvedValue({ data: { conversations: [conversation()] }, error: null });
    services.fetchFollows.mockResolvedValue({
      data: { following: [writer(2, 'maya'), writer(3, 'omar')], followers: [writer(4, 'lena'), writer(2, 'maya')] },
      error: null,
    });
    services.thread.mockResolvedValue({
      data: { conversation: conversation(), messages: [message(29, 'Coffee?', true), message(30, 'See you Sunday')], hasMore: false },
      error: null,
    });
    services.markRead.mockResolvedValue({ data: { unreadCount: 0 }, error: null });
  });

  it('offers to write only to the writers who follow the reader back, and opens the conversation', async () => {
    services.open.mockResolvedValue({ data: conversation({ id: 9 }), error: null });
    const { onOpenConversation } = renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Write to maya' }));

    expect(screen.queryByRole('button', { name: 'Write to omar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write to lena' })).not.toBeInTheDocument();
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith(9));
    expect(services.open).toHaveBeenCalledWith(2);
    expect(screen.getByText('Choose a conversation, or write to someone.')).toBeInTheDocument();
  });

  it('says when nobody can be written to yet, and when a conversation could not be opened', async () => {
    services.fetchFollows.mockResolvedValueOnce({ data: { following: [], followers: [] }, error: null });
    services.list.mockResolvedValue({ data: { conversations: [] }, error: null });
    renderPage();

    expect(await screen.findByText(/Once you and another writer follow each other/)).toBeInTheDocument();
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument();
  });

  it('shows why a conversation could not be opened', async () => {
    services.open.mockResolvedValue({ data: null, error: 'apiError_USER_NOT_FOUND' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Write to maya' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be found');
  });

  it('lists the conversations with their newest message and what is unread', async () => {
    services.list.mockResolvedValue({
      data: { conversations: [conversation(), conversation({ id: 8, writer: { id: 3, username: 'omar', avatarUrl: null }, unreadCount: 0, lastMessage: message(12, 'Thanks', true) })] },
      error: null,
    });
    const { onOpenConversation } = renderPage();

    const maya = await conversationButton('maya');
    expect(maya).toHaveTextContent('See you Sunday');
    expect(maya).toHaveTextContent('2 new');
    expect(screen.getByText('See you Sunday')).toHaveClass('privacy-text');
    const omar = await conversationButton('omar');
    expect(omar).toHaveTextContent('You: Thanks');
    fireEvent.click(omar);
    expect(onOpenConversation).toHaveBeenCalledWith(8);
  });

  it('keeps the unread count out of quiet mode', async () => {
    renderPage(null, { quiet: true });

    const maya = await conversationButton('maya');
    expect(maya).toHaveTextContent('New');
    expect(maya).not.toHaveTextContent('2 new');
  });

  it('says when the conversations could not be loaded', async () => {
    services.list.mockResolvedValue({ data: null, error: 'messagesLoadError' });
    services.fetchFollows.mockResolvedValue({ data: null, error: 'Failed' });
    renderPage();

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Your messages could not be loaded');
  });

  it('shows the open conversation, marks it read and goes back to the list', async () => {
    const { onOpenConversation } = renderPage(7);

    const thread = await screen.findByRole('region', { name: 'Conversation with maya' });
    const log = within(thread).getByRole('log');
    expect(within(log).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toEqual(['Coffee?', 'See you Sunday']);
    expect(within(log).getAllByRole('listitem')[0]).toHaveClass('mine');
    expect(await conversationButton('maya')).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(services.markRead).toHaveBeenCalledWith(7));

    fireEvent.click(within(thread).getByRole('button', { name: 'All conversations' }));
    expect(onOpenConversation).toHaveBeenCalledWith(null);
  });

  it('sends with Enter, keeps Shift+Enter for a new line, and empties the field once sent', async () => {
    services.send.mockResolvedValue({ data: message(31, 'Lovely', true), error: null });
    renderPage(7);

    const field = await screen.findByLabelText('Message to maya');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.change(field, { target: { value: '  Lovely  ' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(services.send).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() => expect(services.send).toHaveBeenCalledWith(7, 'Lovely'));
    await waitFor(() => expect(field).toHaveValue(''));
    expect(services.thread.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps the text and says why when a message could not be sent', async () => {
    services.send.mockResolvedValue({ data: null, error: 'apiError_CONVERSATION_READ_ONLY' });
    renderPage(7);

    const field = await screen.findByLabelText('Message to maya');
    fireEvent.change(field, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You can write only to a writer who follows you and whom you follow.');
    expect(field).toHaveValue('Hello');
  });

  it('reads a conversation it can no longer be written in, and an empty one', async () => {
    services.thread.mockResolvedValueOnce({
      data: { conversation: conversation({ canWrite: false, unreadCount: 0 }), messages: [], hasMore: false },
      error: null,
    });
    renderPage(7);

    expect(await screen.findByText('No messages yet. Say hello to maya.')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('you can read this conversation but not answer it');
    expect(screen.queryByLabelText('Message to maya')).not.toBeInTheDocument();
    expect(services.markRead).not.toHaveBeenCalled();
  });

  it('loads earlier messages above the newest ones', async () => {
    services.thread.mockImplementation((_id: number, before?: number) => Promise.resolve({
      data: before
        ? { conversation: conversation(), messages: [message(5, 'Long ago')], hasMore: false }
        : { conversation: conversation({ unreadCount: 0 }), messages: [message(29, 'Coffee?', true)], hasMore: true },
      error: null,
    }));
    renderPage(7);

    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier messages' }));

    await waitFor(() => expect(screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toContain('Long ago'));
    const log = screen.getByRole('log');
    expect(within(log).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent)).toEqual(['Long ago', 'Coffee?']);
    expect(services.thread).toHaveBeenCalledWith(7, 29);
    expect(screen.queryByRole('button', { name: 'Show earlier messages' })).not.toBeInTheDocument();
  });

  it('says when the conversation could not be read', async () => {
    services.thread.mockResolvedValue({ data: null, error: 'apiError_CONVERSATION_NOT_FOUND' });
    renderPage(7);

    expect(await screen.findByText('This conversation is no longer here.')).toBeInTheDocument();
  });
});
