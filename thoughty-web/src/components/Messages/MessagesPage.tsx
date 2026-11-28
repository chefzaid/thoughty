import { useState } from 'react';

import type { FollowedUser } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { FeedAvatar } from '../FeedPage/FeedAuthor';
import PageHeader from '../PageHeader/PageHeader';
import ConversationList from './ConversationList';
import ConversationView from './ConversationView';
import { useConversations } from './useMessages';
import { useWritersToMessage } from './useWritersToMessage';
import '../FeedPage/FeedPage.css';
import './MessagesPage.css';

export interface MessagesPageProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  /** The open conversation, from the address; null for none. */
  readonly conversationId: number | null;
  readonly onOpenConversation: (id: number | null) => void;
  readonly t: TranslationFunction;
}

/**
 * Messages between writers who follow each other: the writers the reader may write to, their conversations
 * the most recent first, and the open one beside them (alone on a narrow screen, with a way back).
 */
export default function MessagesPage({ theme = 'dark', language: languageSetting, conversationId, onOpenConversation, t }: MessagesPageProps) {
  const language = resolveLanguage(languageSetting);
  const { list, open } = useConversations();
  const writers = useWritersToMessage();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const writeTo = async (writer: FollowedUser) => {
    setOpeningId(writer.id);
    setOpenError(null);
    const result = await open(writer.id);
    setOpeningId(null);
    if (result.data) onOpenConversation(result.data.id);
    else setOpenError(result.error ?? 'messagesOpenError');
  };

  const conversations = list.data?.conversations ?? [];
  return (
    <section className={`messages-page ${theme}${conversationId === null ? '' : ' has-thread'}`}>
      <PageHeader title={t('messages')} subtitle={t('messagesSubtitle')} theme={theme} />
      <div className="messages-layout">
        <div className="messages-sidebar">
          <section className="messages-panel" aria-labelledby="messages-start-heading">
            <h2 id="messages-start-heading">{t('messagesStartTitle')}</h2>
            {writers.data?.length === 0 && <p className="messages-note">{t('messagesStartEmpty')}</p>}
            {writers.isError && <p className="messages-error" role="alert">{t('messagesLoadError')}</p>}
            {writers.data && writers.data.length > 0 && (
              <ul className="messages-writers">
                {writers.data.map((writer) => (
                  <li key={writer.id}>
                    <button
                      type="button"
                      aria-label={t('messagesWriteTo', { username: writer.username })}
                      disabled={openingId === writer.id}
                      onClick={() => void writeTo(writer)}
                    >
                      <FeedAvatar author={writer} />
                      <span>{writer.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {openError && <p className="messages-error" role="alert">{t(openError)}</p>}
          </section>
          <section className="messages-panel" aria-labelledby="messages-conversations-heading">
            <h2 id="messages-conversations-heading">{t('messagesConversationsTitle')}</h2>
            {list.isError && <p className="messages-error" role="alert">{t(list.error.message)}</p>}
            {list.data && conversations.length === 0 && <p className="messages-note">{t('messagesConversationsEmpty')}</p>}
            {conversations.length > 0 && (
              <ConversationList
                conversations={conversations}
                selectedId={conversationId}
                language={language}
                onSelect={onOpenConversation}
                t={t}
              />
            )}
          </section>
        </div>
        <div className="messages-main">
          {conversationId === null
            ? <p className="messages-note messages-choose">{t('messagesChoose')}</p>
            : <ConversationView key={conversationId} conversationId={conversationId} language={language} onBack={() => onOpenConversation(null)} theme={theme} t={t} />}
        </div>
      </div>
    </section>
  );
}
