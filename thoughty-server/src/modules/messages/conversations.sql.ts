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

/**
 * The entry a message (`m`) shares, as `se`, only while the reader may read it in the feed: public, visible to
 * moderation, not archived and outside the recycle bin, and either the reader's own or by a writer who does not
 * approve their followers or approved the reader's follow. Otherwise `se` is empty and the message says the
 * entry is no longer shared.
 */
const SHARED_ENTRY_JOIN = `
  LEFT JOIN entries se ON se.id = m.entry_id
   AND se.visibility = 'public'
   AND se.moderation_status = 'visible'
   AND se.is_archived = false
   AND se.deleted_at IS NULL
   AND (se.user_id = $1
     OR NOT EXISTS (SELECT 1 FROM users aw WHERE aw.id = se.user_id AND aw.followers_by_approval)
     OR EXISTS (
       SELECT 1 FROM user_follows af
        WHERE af.follower_id = $1 AND af.followed_id = se.user_id AND af.status = 'approved'
     ))
`;

/** A message's columns, the entry it shares as `se`, from `messages m` and {@link SHARED_ENTRY_JOIN}. */
const MESSAGE_SELECT = `
  SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
         m.entry_id AS shared_entry_ref, se.id AS entry_id, to_char(se.date, 'YYYY-MM-DD') AS entry_date,
         se.index AS entry_index, se.title AS entry_title
    FROM messages m
    ${SHARED_ENTRY_JOIN}
`;

/** A page of a conversation's messages (`$2`), the newest first, before the message `$3` when given. */
export const THREAD_PAGE_SQL = (limit: number) => `
  ${MESSAGE_SELECT}
   WHERE m.conversation_id = $2 AND ($3::int IS NULL OR m.id < $3)
   ORDER BY m.id DESC
   LIMIT ${limit}
`;

/** The reader's conversations they may see, each with its other writer, newest message and unread count. */
export const CONVERSATION_SUMMARY_SQL = `
  SELECT c.id, c.last_message_at,
         o.id AS writer_id, o.username, o.avatar_url,
         lm.id AS last_id, lm.sender_id AS last_sender_id, lm.body AS last_body, lm.created_at AS last_created_at,
         lm.shared_entry_ref AS last_shared_entry_ref, lm.entry_id AS last_entry_id, lm.entry_date AS last_entry_date,
         lm.entry_index AS last_entry_index, lm.entry_title AS last_entry_title,
         (SELECT COUNT(*)::int FROM messages um
           WHERE um.conversation_id = c.id AND um.sender_id <> $1 AND um.id > me.last_read_message_id) AS unread_count,
         ${followEachOther('o.id')} AS can_write
    FROM conversation_members me
    JOIN conversations c ON c.id = me.conversation_id
    JOIN conversation_members om ON om.conversation_id = c.id AND om.user_id <> me.user_id
    JOIN users o ON o.id = om.user_id AND o.deleted_at IS NULL
    LEFT JOIN LATERAL (
      ${MESSAGE_SELECT}
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

/**
 * The sender's (`$1`) entry `$2` when a message may share it: theirs, public, visible to moderation, not archived
 * and outside the recycle bin, so the writer they follow each other with can already read it in the feed.
 */
export const SHAREABLE_ENTRY_SQL = `
  SELECT e.id, to_char(e.date, 'YYYY-MM-DD') AS date, e.index, e.title,
         (e.visibility = 'public' AND e.moderation_status = 'visible' AND e.is_archived = false) AS shareable
    FROM entries e
   WHERE e.id = $2 AND e.user_id = $1 AND e.deleted_at IS NULL
`;

/** Whether the reader (`$1`) may start a conversation with the writer `$2`. */
export const CAN_WRITE_TO_SQL = `
  SELECT ${followEachOther('u.id')} AS allowed
    FROM users u
   WHERE u.id = $2 AND u.deleted_at IS NULL AND ${notBlockedEitherWay('u.id')}
`;
