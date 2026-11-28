import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService, MESSAGE_PAGE_SIZE } from './conversations.service';

const summaryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  writer_id: 2,
  username: 'maya',
  avatar_url: null,
  last_id: 30,
  last_sender_id: 2,
  last_body: 'See you there',
  last_created_at: new Date('2026-11-28T08:30:00Z'),
  unread_count: '1',
  can_write: true,
  ...overrides,
});

const messageRow = (id: number, senderId = 4) => ({
  id,
  conversation_id: 7,
  sender_id: senderId,
  body: `Message ${id}`,
  created_at: new Date('2026-11-28T08:00:00Z'),
});

describe('ConversationsService', () => {
  const manager = { query: jest.fn() };
  const dataSource = {
    query: jest.fn(),
    transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)),
  };
  const service = new ConversationsService(dataSource as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists the conversations with a message, each with its writer, newest message and unread count', async () => {
    dataSource.query.mockResolvedValueOnce([
      summaryRow(),
      summaryRow({ id: 8, last_sender_id: 4, can_write: false, unread_count: 0 }),
    ]);

    const { conversations } = await service.list(4);

    expect(dataSource.query.mock.calls[0][0]).toContain('c.last_message_at IS NOT NULL');
    expect(dataSource.query.mock.calls[0][1]).toEqual([4]);
    expect(conversations[0]).toEqual({
      id: 7,
      writer: { id: 2, username: 'maya', avatarUrl: null },
      lastMessage: {
        id: 30,
        conversationId: 7,
        senderId: 2,
        mine: false,
        body: 'See you there',
        createdAt: '2026-11-28T08:30:00.000Z',
      },
      unreadCount: 1,
      canWrite: true,
    });
    expect(conversations[1]).toEqual(expect.objectContaining({ canWrite: false, unreadCount: 0 }));
    expect(conversations[1].lastMessage?.mine).toBe(true);
  });

  it('counts the unread messages, none without a row', async () => {
    dataSource.query.mockResolvedValueOnce([{ count: '3' }]).mockResolvedValueOnce([]);

    await expect(service.countUnread(4)).resolves.toEqual({ unreadCount: 3 });
    await expect(service.countUnread(4)).resolves.toEqual({ unreadCount: 0 });
  });

  describe('open', () => {
    it('refuses the writer themselves', async () => {
      await expect(service.open(4, 4)).rejects.toThrow(BadRequestException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('answers as missing a writer the reader does not follow both ways', async () => {
      dataSource.query.mockResolvedValueOnce([{ allowed: false }]);
      await expect(service.open(4, 2)).rejects.toThrow(NotFoundException);
      dataSource.query.mockResolvedValueOnce([]);
      await expect(service.open(4, 2)).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('makes the conversation once per pair, the lower id first, with both writers in it', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ allowed: true }])
        .mockResolvedValueOnce([summaryRow({ last_id: null, unread_count: 0 })]);
      manager.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([]);

      const conversation = await service.open(4, 2);

      expect(manager.query.mock.calls[0][0]).toContain(
        'ON CONFLICT ON CONSTRAINT uq_conversations_direct DO NOTHING',
      );
      expect(manager.query.mock.calls[0][1]).toEqual([2, 4]);
      expect(manager.query.mock.calls[2][1]).toEqual([7, 2, 4]);
      expect(dataSource.query.mock.calls[1][1]).toEqual([4, 7]);
      expect(conversation).toEqual(
        expect.objectContaining({ id: 7, lastMessage: null, unreadCount: 0 }),
      );
    });
  });

  describe('thread', () => {
    it('reads the newest page oldest first, and says when older messages remain', async () => {
      const rows = Array.from({ length: MESSAGE_PAGE_SIZE + 1 }, (_, index) =>
        messageRow(200 - index),
      );
      dataSource.query.mockResolvedValueOnce([summaryRow()]).mockResolvedValueOnce(rows);

      const thread = await service.thread(4, 7);

      expect(dataSource.query.mock.calls[1][1]).toEqual([7, null]);
      expect(thread.hasMore).toBe(true);
      expect(thread.messages).toHaveLength(MESSAGE_PAGE_SIZE);
      expect(thread.messages[0].id).toBe(200 - MESSAGE_PAGE_SIZE + 1);
      expect(thread.messages.at(-1)).toEqual(expect.objectContaining({ id: 200, mine: true }));
    });

    it('reads before a message, and refuses a conversation the reader is not in', async () => {
      dataSource.query
        .mockResolvedValueOnce([summaryRow()])
        .mockResolvedValueOnce([messageRow(5, 2)]);
      const thread = await service.thread(4, 7, 6);
      expect(dataSource.query.mock.calls[1][1]).toEqual([7, 6]);
      expect(thread).toEqual(expect.objectContaining({ hasMore: false }));
      expect(thread.messages[0].mine).toBe(false);

      dataSource.query.mockResolvedValueOnce([]);
      await expect(service.thread(4, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('send', () => {
    it('stores the message, moves the conversation up and counts it read by its sender', async () => {
      dataSource.query.mockResolvedValueOnce([summaryRow()]);
      manager.query.mockResolvedValueOnce([messageRow(31)]).mockResolvedValue([]);

      const message = await service.send(4, 7, 'Hello');

      expect(manager.query.mock.calls[0][1]).toEqual([7, 4, 'Hello']);
      expect(manager.query.mock.calls[1][0]).toContain('UPDATE conversations SET last_message_at');
      expect(manager.query.mock.calls[2][1]).toEqual([7, 4, 31]);
      expect(message).toEqual(expect.objectContaining({ id: 31, mine: true, body: 'Message 31' }));
    });

    it('refuses to write once the writers no longer follow each other', async () => {
      dataSource.query.mockResolvedValueOnce([summaryRow({ can_write: false })]);
      await expect(service.send(4, 7, 'Hello')).rejects.toThrow(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  it('marks a conversation read and answers what is left unread', async () => {
    dataSource.query
      .mockResolvedValueOnce([summaryRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 2 }]);

    await expect(service.markRead(4, 7)).resolves.toEqual({ unreadCount: 2 });
    expect(dataSource.query.mock.calls[1][0]).toContain('SET last_read_message_id = GREATEST(');
    expect(dataSource.query.mock.calls[1][1]).toEqual([7, 4]);
  });
});
