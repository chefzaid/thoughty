import type { OptInEmailSetting } from '@/database/entities';

/** An opt-in email setting as the data download writes it, null when it was never saved. */
export function exportOptInEmail(setting: OptInEmailSetting | null) {
  return setting
    ? {
        enabled: setting.enabled,
        deliveryHour: setting.deliveryHour,
        timeZone: setting.timeZone,
        diaryId: setting.diaryId,
        nextSendAt: setting.nextSendAt,
        lastSentOn: setting.lastSentOn,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      }
    : null;
}

/**
 * Every conversation the writer is in, with every message in it from either writer, oldest first: what they
 * wrote and what was written to them. A conversation hidden by a block is still theirs, so it is included.
 */
export const CONVERSATIONS_DOWNLOAD_SQL = `
  SELECT c.id AS conversation_id, c.created_at AS conversation_created_at, o.id AS writer_id, o.username,
         m.id AS message_id, m.sender_id, m.body, m.created_at
    FROM conversation_members me
    JOIN conversations c ON c.id = me.conversation_id
    JOIN conversation_members om ON om.conversation_id = c.id AND om.user_id <> me.user_id
    JOIN users o ON o.id = om.user_id
    LEFT JOIN messages m ON m.conversation_id = c.id
   WHERE me.user_id = $1
   ORDER BY c.id, m.id
`;

export interface ConversationDownloadRow {
  conversation_id: number;
  conversation_created_at: Date;
  writer_id: number;
  username: string;
  message_id: number | null;
  sender_id: number | null;
  body: string | null;
  created_at: Date | null;
}

/** The rows of {@link CONVERSATIONS_DOWNLOAD_SQL} as one item per conversation, each with its messages. */
export function exportConversations(rows: ConversationDownloadRow[], userId: number) {
  const conversations = new Map<
    number,
    {
      id: number;
      with: { userId: number; username: string };
      createdAt: Date;
      messages: { id: number; sentByMe: boolean; body: string; sentAt: Date }[];
    }
  >();
  for (const row of rows) {
    const id = Number(row.conversation_id);
    const conversation = conversations.get(id) ?? {
      id,
      with: { userId: Number(row.writer_id), username: row.username },
      createdAt: row.conversation_created_at,
      messages: [],
    };
    conversations.set(id, conversation);
    if (row.message_id !== null) {
      conversation.messages.push({
        id: Number(row.message_id),
        sentByMe: Number(row.sender_id) === userId,
        body: row.body as string,
        sentAt: row.created_at as Date,
      });
    }
  }
  return [...conversations.values()];
}
