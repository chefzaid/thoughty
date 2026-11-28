import type { Conversation } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { FeedAvatar } from '../FeedPage/FeedAuthor';
import { useQuietMode } from '../QuietMode/quietMode';

interface ConversationListProps {
  readonly conversations: readonly Conversation[];
  readonly selectedId: number | null;
  readonly language: Language;
  readonly onSelect: (id: number) => void;
  readonly t: TranslationFunction;
}

/** The conversations, the most recent first: who with, the newest message and when, and what is unread. */
export default function ConversationList({ conversations, selectedId, language, onSelect, t }: ConversationListProps) {
  const quiet = useQuietMode();
  const timeFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <ul className="messages-conversations">
      {conversations.map((conversation) => {
        const last = conversation.lastMessage;
        const unread = conversation.unreadCount > 0;
        return (
          <li key={conversation.id}>
            <button
              type="button"
              className={`messages-conversation${unread ? ' unread' : ''}`}
              aria-current={conversation.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(conversation.id)}
            >
              <FeedAvatar author={conversation.writer} />
              <span className="messages-conversation-text">
                <span className="messages-conversation-name">{conversation.writer.username}</span>
                {last && (
                  <span className="messages-conversation-preview privacy-text">
                    {last.mine ? t('messagesFromYou', { text: last.body }) : last.body}
                  </span>
                )}
              </span>
              <span className="messages-conversation-meta">
                {last && <time dateTime={last.createdAt}>{timeFormat.format(new Date(last.createdAt))}</time>}
                {unread && (
                  <span className="messages-unread">
                    {quiet ? t('messagesUnreadQuiet') : pluralPhrase(t, 'messagesUnread', conversation.unreadCount, language)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
