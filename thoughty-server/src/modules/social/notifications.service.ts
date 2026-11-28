import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NotificationRead } from '@/database/entities';
import type { NotificationDto, NotificationsResponseDto, NotificationType } from './dto';

/** How many notifications the list holds, the most recent first. */
export const NOTIFICATION_LIST_LIMIT = 30;
/** How much of a comment a notification quotes. */
export const NOTIFICATION_EXCERPT_LENGTH = 140;

/**
 * What a writer is told about, read straight from where it is kept, with the reader as `$1`: comments on their
 * entries and likes on them, likes on their comments, new followers, requests to follow them still waiting
 * for their approval (which become a new follower once approved, and go once declined or withdrawn), and the
 * messages they have not read, one notification per conversation dated by its newest unread message, so a burst
 * of messages is one notification and reading the conversation takes it away. Only what is still there counts: a like
 * taken back, a comment removed or hidden, a follow ended or an account deleted takes its notification away. It
 * leaves out the reader's own doings, everyone they blocked or who blocked them and the writers they muted, as
 * the feed does, and anything about an entry the feed no longer shows (private again, archived, moderated, in the
 * recycle bin, or by a writer blocked either way), since that is where a notification leads.
 */
const ACTIVITY_CTE = `
  WITH blocked AS (
    SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = $1
    UNION SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
  ),
  hidden AS (
    SELECT id FROM blocked
    UNION SELECT muted_id FROM user_mutes WHERE user_id = $1
  ),
  activity AS (
    SELECT 'comment' AS type, c.created_at, c.user_id AS actor_id, c.entry_id, c.id AS comment_id,
           NULL::int AS conversation_id, NULL::int AS message_id, NULL::int AS message_count
      FROM entry_comments c
      JOIN entries ce ON ce.id = c.entry_id
     WHERE ce.user_id = $1 AND c.hidden_at IS NULL
    UNION ALL
    SELECT 'entryLike', l.created_at, l.user_id, l.entry_id, NULL, NULL, NULL, NULL
      FROM entry_likes l
      JOIN entries le ON le.id = l.entry_id
     WHERE le.user_id = $1
    UNION ALL
    SELECT 'commentLike', cl.created_at, cl.user_id, lc.entry_id, lc.id, NULL, NULL, NULL
      FROM comment_likes cl
      JOIN entry_comments lc ON lc.id = cl.comment_id
     WHERE lc.user_id = $1
    UNION ALL
    SELECT CASE f.status WHEN 'pending' THEN 'followRequest' ELSE 'follow' END, f.created_at, f.follower_id,
           NULL, NULL, NULL, NULL, NULL
      FROM user_follows f
     WHERE f.followed_id = $1
    UNION ALL
    SELECT 'message', um.created_at, um.sender_id, NULL, NULL, um.conversation_id, um.id, um.message_count
      FROM (
        SELECT DISTINCT ON (m.conversation_id) m.conversation_id, m.id, m.sender_id, m.created_at,
               (COUNT(*) OVER (PARTITION BY m.conversation_id))::int AS message_count
          FROM conversation_members me
          JOIN messages m ON m.conversation_id = me.conversation_id
                         AND m.sender_id <> $1
                         AND m.id > me.last_read_message_id
         WHERE me.user_id = $1
         ORDER BY m.conversation_id, m.id DESC
      ) um
  )
`;

/**
 * The notifications found by {@link ACTIVITY_CTE}, as `a`, with who did it (`u`), the entry (`e`), the comment
 * (`c`) and the newest unread message (`nm`). A message's writer deleted or blocked either way takes it away as
 * the conversation leaves the Messages page.
 */
const ACTIVITY_FROM = `
  FROM activity a
  JOIN users u ON u.id = a.actor_id AND u.deleted_at IS NULL
  LEFT JOIN entries e ON e.id = a.entry_id
  LEFT JOIN users eu ON eu.id = e.user_id
  LEFT JOIN entry_comments c ON c.id = a.comment_id
  LEFT JOIN messages nm ON nm.id = a.message_id
  LEFT JOIN notification_reads r ON r.user_id = $1
  WHERE a.actor_id <> $1
    AND a.actor_id NOT IN (SELECT id FROM hidden)
    AND (
      a.entry_id IS NULL OR (
        e.visibility = 'public'
        AND e.moderation_status = 'visible'
        AND e.is_archived = false
        AND e.deleted_at IS NULL
        AND eu.deleted_at IS NULL
        AND e.user_id NOT IN (SELECT id FROM blocked)
      )
    )
`;

/** Whether the notification came after the reader last opened their notifications (never, without a row). */
const UNREAD_SQL = `a.created_at > COALESCE(r.read_at, '-infinity'::timestamptz)`;

interface NotificationRow {
  type: NotificationType;
  created_at: Date;
  unread: boolean;
  actor_id: number;
  username: string;
  avatar_url: string | null;
  entry_id: number | null;
  entry_date: string | null;
  entry_index: number | null;
  entry_title: string | null;
  comment_id: number | null;
  comment_excerpt: string | null;
  conversation_id: number | null;
  message_count: number | null;
  message_excerpt: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationRead)
    private readonly readRepository: Repository<NotificationRead>,
  ) {}

  /** The most recent notifications, newest first, each marked new or not, and how many are new. */
  async list(userId: number): Promise<NotificationsResponseDto> {
    const [rows, unreadCount] = await Promise.all([
      this.readRepository.query(
        `${ACTIVITY_CTE}
         SELECT a.type, a.created_at, ${UNREAD_SQL} AS unread,
                a.actor_id, u.username, u.avatar_url,
                a.entry_id, to_char(e.date, 'YYYY-MM-DD') AS entry_date, e.index AS entry_index, e.title AS entry_title,
                a.comment_id, left(c.content, ${NOTIFICATION_EXCERPT_LENGTH}) AS comment_excerpt,
                a.conversation_id, a.message_count, left(nm.body, ${NOTIFICATION_EXCERPT_LENGTH}) AS message_excerpt
         ${ACTIVITY_FROM}
         ORDER BY a.created_at DESC, a.type, a.actor_id DESC, a.comment_id DESC, a.entry_id DESC,
                  a.conversation_id DESC
         LIMIT ${NOTIFICATION_LIST_LIMIT}`,
        [userId],
      ) as Promise<NotificationRow[]>,
      this.countUnread(userId),
    ]);
    return { notifications: rows.map(toNotification), unreadCount };
  }

  /** How many notifications came after the reader last opened them. */
  async countUnread(userId: number): Promise<number> {
    const [row] = (await this.readRepository.query(
      `${ACTIVITY_CTE} SELECT COUNT(*)::int AS count ${ACTIVITY_FROM} AND ${UNREAD_SQL}`,
      [userId],
    )) as { count: number | string }[];
    return Number(row?.count ?? 0);
  }

  /** The reader opened their notifications: everything until now is no longer new. */
  async markRead(userId: number): Promise<void> {
    await this.readRepository.query(
      `INSERT INTO notification_reads (user_id, read_at) VALUES ($1, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET read_at = GREATEST(notification_reads.read_at, EXCLUDED.read_at)`,
      [userId],
    );
  }
}

/**
 * A key that stays the same for the same notification: its type and what it is about, and who for a like, a
 * follow or a request; the conversation for messages.
 */
function notificationKey(row: NotificationRow): string {
  switch (row.type) {
    case 'comment':
      return `comment:${row.comment_id}`;
    case 'follow':
      return `follow:${row.actor_id}`;
    case 'followRequest':
      return `followRequest:${row.actor_id}`;
    case 'entryLike':
      return `entryLike:${row.entry_id}:${row.actor_id}`;
    case 'message':
      return `message:${row.conversation_id}`;
    default:
      return `commentLike:${row.comment_id}:${row.actor_id}`;
  }
}

function toNotification(row: NotificationRow): NotificationDto {
  return {
    id: notificationKey(row),
    type: row.type,
    createdAt: new Date(row.created_at).toISOString(),
    unread: row.unread === true,
    actor: { id: Number(row.actor_id), username: row.username, avatarUrl: row.avatar_url },
    // Every entry and comment a notification names was joined by the query that found it
    entry:
      row.entry_id === null
        ? null
        : {
            id: Number(row.entry_id),
            date: row.entry_date as string,
            index: Number(row.entry_index),
            title: row.entry_title,
          },
    comment:
      row.comment_id === null
        ? null
        : { id: Number(row.comment_id), excerpt: row.comment_excerpt as string },
    conversation:
      row.conversation_id === null
        ? null
        : {
            id: Number(row.conversation_id),
            messageCount: Number(row.message_count),
            excerpt: row.message_excerpt as string,
          },
  };
}
