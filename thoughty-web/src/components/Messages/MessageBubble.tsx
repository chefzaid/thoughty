import type { ChatMessage } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import MessageSharedEntry from './MessageSharedEntry';

interface MessageBubbleProps {
  readonly message: ChatMessage;
  readonly language: Language;
  readonly timeFormat: Intl.DateTimeFormat;
  /** Asks to delete the message for the reader. */
  readonly onDelete: (message: ChatMessage) => void;
  readonly t: TranslationFunction;
}

/** One message in a conversation: its text, the entry it shares, when it was sent, and deleting it for oneself. */
export default function MessageBubble({ message, language, timeFormat, onDelete, t }: MessageBubbleProps) {
  return (
    <li className={`messages-bubble${message.mine ? ' mine' : ''}`}>
      <p className="privacy-text">{message.body}</p>
      <MessageSharedEntry message={message} language={language} t={t} />
      <div className="messages-bubble-meta">
        <time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))}</time>
        <button
          type="button"
          className="messages-bubble-delete"
          aria-label={t('messageDelete')}
          title={t('messageDelete')}
          onClick={() => onDelete(message)}
        >
          <span className="codicon codicon-trash" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
