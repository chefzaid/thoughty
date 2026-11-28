import { Link } from 'react-router-dom';

import type { ChatMessage } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatEntryDay } from '../ShareLinks/shareLinkText';

interface MessageSharedEntryProps {
  readonly message: Pick<ChatMessage, 'entry' | 'entryUnavailable'>;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/**
 * The public entry a message shares, by its title or else its day, with a link to it in the feed; or a note that
 * it is no longer shared once the reader cannot read it there. Nothing for a message that shares no entry.
 */
export default function MessageSharedEntry({ message, language, t }: MessageSharedEntryProps) {
  const { entry } = message;
  if (entry) {
    const label = entry.title ? t('notificationEntryTitle', { title: entry.title }) : formatEntryDay(entry.date, language);
    return (
      <div className="messages-shared-entry">
        <span className="codicon codicon-note" aria-hidden="true" />
        <span>{t('messageSharedEntry', { entry: label })}</span>
        <Link to={`/feed?entry=${entry.id}`}>{t('messageSharedEntryOpen')}</Link>
      </div>
    );
  }
  if (message.entryUnavailable) {
    return <p className="messages-shared-entry gone">{t('messageSharedEntryGone')}</p>;
  }
  return null;
}
