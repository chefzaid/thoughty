/**
 * The SQL behind messages between writers, with the reader as `$1`. A conversation shows only while its other
 * writer's account is not deleted and neither has blocked the other; a writer may write in it only while they
 * follow each other, both follows approved.
 */

/** The writer in `column` and the reader follow each other, both follows approved. */
export function followEachOther(column: string): string {
  return `(EXISTS (
      SELECT 1 FROM user_follows fo
       WHERE fo.follower_id = $1 AND fo.followed_id = ${column} AND fo.status = 'approved'
    ) AND EXISTS (
      SELECT 1 FROM user_follows fb
       WHERE fb.follower_id = ${column} AND fb.followed_id = $1 AND fb.status = 'approved'
    ))`;
}

/** Neither the reader nor the writer in `column` has blocked the other. */
export function notBlockedEitherWay(column: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM user_blocks ub
     WHERE (ub.blocker_id = $1 AND ub.blocked_id = ${column})
        OR (ub.blocked_id = $1 AND ub.blocker_id = ${column})
  )`;
}

/** The reader's conversations they may see, each with its other writer, newest message and unread count. */
export const CONVERSATION_SUMMARY_SQL = `
  SELECT c.id, c.last_message_at,
         o.id AS writer_id, o.username, o.avatar_url,
         lm.id AS last_id, lm.sender_id AS last_sender_id, lm.body AS last_body, lm.created_at AS last_created_at,
         (SELECT COUNT(*)::int FROM messages um
           WHERE um.conversation_id = c.id AND um.sender_id <> $1 AND um.id > me.last_read_message_id) AS unread_count,
         ${followEachOther('o.id')} AS can_write
    FROM conversation_members me
    JOIN conversations c ON c.id = me.conversation_id
    JOIN conversation_members om ON om.conversation_id = c.id AND om.user_id <> me.user_id
    JOIN users o ON o.id = om.user_id AND o.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT m.id, m.sender_id, m.body, m.created_at
        FROM messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.id DESC
       LIMIT 1
    ) lm ON true
   WHERE me.user_id = $1
     AND ${notBlockedEitherWay('o.id')}
`;

/** Unread messages across the reader's conversations they may see. */
export const UNREAD_COUNT_SQL = `
  SELECT COUNT(*)::int AS count
    FROM conversation_members me
    JOIN messages m ON m.conversation_id = me.conversation_id AND m.sender_id <> $1 AND m.id > me.last_read_message_id
    JOIN users s ON s.id = m.sender_id AND s.deleted_at IS NULL
   WHERE me.user_id = $1
     AND ${notBlockedEitherWay('m.sender_id')}
`;

/** Whether the reader (`$1`) may start a conversation with the writer `$2`. */
export const CAN_WRITE_TO_SQL = `
  SELECT ${followEachOther('u.id')} AS allowed
    FROM users u
   WHERE u.id = $2 AND u.deleted_at IS NULL AND ${notBlockedEitherWay('u.id')}
`;
