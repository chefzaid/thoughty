import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { apiError } from '@/common/errors';
import { CAN_WRITE_TO_SQL, CONVERSATION_SUMMARY_SQL, UNREAD_COUNT_SQL } from './conversations.sql';
import type {
  ConversationListDto,
  ConversationSummaryDto,
  ConversationThreadDto,
  MessageDto,
  UnreadMessagesDto,
} from './dto';

/** How many conversations the list holds, the most recent first. */
export const CONVERSATION_LIST_LIMIT = 100;
/** How many messages a thread reads at once, the newest first. */
export const MESSAGE_PAGE_SIZE = 50;

interface SummaryRow {
  id: number;
  writer_id: number;
  username: string;
  avatar_url: string | null;
  last_id: number | null;
  last_sender_id: number | null;
  last_body: string | null;
  last_created_at: Date | null;
  unread_count: number | string;
  can_write: boolean;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: Date;
}

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at';

/**
 * One-to-one conversations between writers who follow each other. A conversation stays readable when they no
 * longer do, and leaves both lists while either has blocked the other or the other's account is deleted.
 */
@Injectable()
export class ConversationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** The conversations with at least one message, the most recent first. */
  async list(userId: number): Promise<ConversationListDto> {
    const rows = (await this.dataSource.query(
      `${CONVERSATION_SUMMARY_SQL}
         AND c.last_message_at IS NOT NULL
       ORDER BY c.last_message_at DESC, c.id DESC
       LIMIT ${CONVERSATION_LIST_LIMIT}`,
      [userId],
    )) as SummaryRow[];
    return { conversations: rows.map((row) => toSummary(row, userId)) };
  }

  /** Unread messages across every conversation the reader sees. */
  async countUnread(userId: number): Promise<UnreadMessagesDto> {
    const [row] = (await this.dataSource.query(UNREAD_COUNT_SQL, [userId])) as {
      count: number | string;
    }[];
    return { unreadCount: Number(row?.count ?? 0) };
  }

  /**
   * The conversation with a writer the reader follows and who follows them, made the first time. Any other
   * writer answers as missing, so accounts cannot be probed.
   */
  async open(userId: number, writerId: number): Promise<ConversationSummaryDto> {
    if (userId === writerId) {
      throw apiError(BadRequestException, 'SOCIAL_CANNOT_MESSAGE_SELF');
    }
    const [target] = (await this.dataSource.query(CAN_WRITE_TO_SQL, [userId, writerId])) as {
      allowed: boolean;
    }[];
    if (!target?.allowed) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }

    const [low, high] = userId < writerId ? [userId, writerId] : [writerId, userId];
    const conversationId = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO conversations (direct_low_id, direct_high_id) VALUES ($1, $2)
         ON CONFLICT ON CONSTRAINT uq_conversations_direct DO NOTHING`,
        [low, high],
      );
      const [conversation] = (await manager.query(
        'SELECT id FROM conversations WHERE direct_low_id = $1 AND direct_high_id = $2',
        [low, high],
      )) as { id: number }[];
      await manager.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)
         ON CONFLICT DO NOTHING`,
        [conversation.id, low, high],
      );
      return conversation.id;
    });
    return this.summary(userId, conversationId);
  }

  /** A page of the conversation's messages, oldest first: the newest, or those before `before`. */
  async thread(
    userId: number,
    conversationId: number,
    before?: number,
  ): Promise<ConversationThreadDto> {
    const conversation = await this.summary(userId, conversationId);
    const rows = (await this.dataSource.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages
        WHERE conversation_id = $1 AND ($2::int IS NULL OR id < $2)
        ORDER BY id DESC
        LIMIT ${MESSAGE_PAGE_SIZE + 1}`,
      [conversationId, before ?? null],
    )) as MessageRow[];
    const page = rows.slice(0, MESSAGE_PAGE_SIZE).reverse();
    return {
      conversation,
      messages: page.map((row) => toMessage(row, userId)),
      hasMore: rows.length > MESSAGE_PAGE_SIZE,
    };
  }

  /** Sends a message, which the sender has read; only while the two writers follow each other. */
  async send(userId: number, conversationId: number, body: string): Promise<MessageDto> {
    const conversation = await this.summary(userId, conversationId);
    if (!conversation.canWrite) {
      throw apiError(ForbiddenException, 'CONVERSATION_READ_ONLY');
    }
    const row = await this.dataSource.transaction(async (manager) => {
      const [message] = (await manager.query(
        `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING ${MESSAGE_COLUMNS}`,
        [conversationId, userId, body],
      )) as MessageRow[];
      await manager.query('UPDATE conversations SET last_message_at = $2 WHERE id = $1', [
        conversationId,
        message.created_at,
      ]);
      await manager.query(
        `UPDATE conversation_members SET last_read_message_id = GREATEST(last_read_message_id, $3)
          WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId, message.id],
      );
      return message;
    });
    return toMessage(row, userId);
  }

  /** The reader has read the conversation up to its newest message; answers what is left unread elsewhere. */
  async markRead(userId: number, conversationId: number): Promise<UnreadMessagesDto> {
    await this.summary(userId, conversationId);
    await this.dataSource.query(
      `UPDATE conversation_members
          SET last_read_message_id = GREATEST(
            last_read_message_id,
            COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = $1), 0)
          )
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    return this.countUnread(userId);
  }

  /** One conversation the reader is in and may see; any other answers as missing. */
  private async summary(userId: number, conversationId: number): Promise<ConversationSummaryDto> {
    const [row] = (await this.dataSource.query(`${CONVERSATION_SUMMARY_SQL} AND c.id = $2`, [
      userId,
      conversationId,
    ])) as SummaryRow[];
    if (!row) {
      throw apiError(NotFoundException, 'CONVERSATION_NOT_FOUND');
    }
    return toSummary(row, userId);
  }
}

function toMessage(row: MessageRow, userId: number): MessageDto {
  return {
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    senderId: Number(row.sender_id),
    mine: Number(row.sender_id) === userId,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toSummary(row: SummaryRow, userId: number): ConversationSummaryDto {
  return {
    id: Number(row.id),
    writer: { id: Number(row.writer_id), username: row.username, avatarUrl: row.avatar_url },
    lastMessage:
      row.last_id === null
        ? null
        : toMessage(
            {
              id: row.last_id,
              conversation_id: row.id,
              sender_id: row.last_sender_id as number,
              body: row.last_body as string,
              created_at: row.last_created_at as Date,
            },
            userId,
          ),
    unreadCount: Number(row.unread_count),
    canWrite: row.can_write === true,
  };
}
