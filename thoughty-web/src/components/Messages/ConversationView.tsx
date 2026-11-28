import { useEffect, useRef, useState } from 'react';

import type { ChatMessage } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { FeedAvatar } from '../FeedPage/FeedAuthor';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import { useConversationThread } from './useMessages';

/** What the reader asked to delete for themselves: one message, or the whole conversation. */
type PendingDeletion = { readonly message: ChatMessage } | 'conversation' | null;

interface ConversationViewProps {
  readonly conversationId: number;
  readonly language: Language;
  /** Back to the conversations, where the list and the conversation do not fit side by side. */
  readonly onBack: () => void;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * One conversation: who it is with, its messages oldest first (earlier ones on request), the field to answer in,
 * and deleting a message or the whole conversation for the reader, once confirmed. A deleted conversation goes
 * back to the list.
 */
export default function ConversationView({ conversationId, language, onBack, theme, t }: ConversationViewProps) {
  const { thread, messages, hasMore, loadingEarlier, loadEarlier, send, deleteMessage, deleteConversation } =
    useConversationThread(conversationId);
  const [pending, setPending] = useState<PendingDeletion>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const confirmDeletion = async () => {
    const target = pending;
    setPending(null);
    setDeleteError(null);
    if (target === null) return;
    if (target === 'conversation') {
      const error = await deleteConversation();
      if (error) setDeleteError(error);
      else onBack();
      return;
    }
    setDeleteError(await deleteMessage(target.message.id));
  };

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
        <button type="button" className="messages-delete-conversation" onClick={() => setPending('conversation')}>
          <span className="codicon codicon-trash" aria-hidden="true" />
          {t('conversationDelete')}
        </button>
      </header>
      {deleteError && <p className="messages-error" role="alert">{t(deleteError)}</p>}
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
              <MessageBubble
                key={message.id}
                message={message}
                language={language}
                timeFormat={timeFormat}
                onDelete={(target) => setPending({ message: target })}
                t={t}
              />
            ))}
          </ol>
        </div>
      )}
      {canWrite
        ? <MessageComposer key={conversationId} username={writer.username} onSend={send} t={t} />
        : <p className="messages-note" role="note">{t('messagesReadOnly')}</p>}
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void confirmDeletion()}
        title={t(pending === 'conversation' ? 'conversationDeleteTitle' : 'messageDeleteTitle')}
        message={t(pending === 'conversation' ? 'conversationDeleteConfirm' : 'messageDeleteConfirm', { username: writer.username })}
        theme={theme}
        t={t}
      />
    </section>
  );
}
