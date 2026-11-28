import { useEffect, useRef } from 'react';

import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { FeedAvatar } from '../FeedPage/FeedAuthor';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MessageComposer from './MessageComposer';
import { useConversationThread } from './useMessages';

interface ConversationViewProps {
  readonly conversationId: number;
  readonly language: Language;
  /** Back to the conversations, where the list and the conversation do not fit side by side. */
  readonly onBack: () => void;
  readonly t: TranslationFunction;
}

/** One conversation: who it is with, its messages oldest first (earlier ones on request), and the field to answer in. */
export default function ConversationView({ conversationId, language, onBack, t }: ConversationViewProps) {
  const { thread, messages, hasMore, loadingEarlier, loadEarlier, send } = useConversationThread(conversationId);
  const logRef = useRef<HTMLDivElement>(null);
  const newestId = messages.at(-1)?.id;
  const timeFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });

  // A new message, sent or received, scrolls into view
  useEffect(() => {
    const log = logRef.current;
    if (log && newestId !== undefined) log.scrollTop = log.scrollHeight;
  }, [newestId]);

  if (thread.isPending) return <LoadingSpinner />;
  if (!thread.data) {
    return <p className="messages-error" role="alert">{t(thread.error?.message ?? 'messagesLoadError')}</p>;
  }

  const { writer, canWrite } = thread.data.conversation;
  return (
    <section className="messages-thread" aria-label={t('messagesThreadLabel', { username: writer.username })}>
      <header className="messages-thread-header">
        <button type="button" className="messages-back" onClick={onBack}>
          <span className="codicon codicon-arrow-left" aria-hidden="true" />
          {t('messagesBack')}
        </button>
        <FeedAvatar author={writer} />
        <h2>{writer.username}</h2>
      </header>
      {hasMore && (
        <button type="button" className="messages-earlier" disabled={loadingEarlier} onClick={() => void loadEarlier()}>
          {t('messagesEarlier')}
        </button>
      )}
      {messages.length === 0 ? (
        <p className="messages-note">{t('messagesThreadEmpty', { username: writer.username })}</p>
      ) : (
        <div className="messages-log" ref={logRef} role="log" aria-live="polite">
          <ol>
            {messages.map((message) => (
              <li key={message.id} className={`messages-bubble${message.mine ? ' mine' : ''}`}>
                <p className="privacy-text">{message.body}</p>
                <time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
      {canWrite
        ? <MessageComposer key={conversationId} username={writer.username} onSend={send} t={t} />
        : <p className="messages-note" role="note">{t('messagesReadOnly')}</p>}
    </section>
  );
}
