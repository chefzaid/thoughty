import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import AttachmentDisplay from '../AttachmentDisplay/AttachmentDisplay';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import type { Entry, Theme, TranslationFunction } from '../../types';
import { isImageAttachment } from '../../utils/attachments';
import { formatTimeOfDay } from '../../utils/entryTime';
import { placedAttachmentIds } from '../../utils/inlineImages';
import type { Language } from '../../utils/translations';

interface ReaderEntryProps {
  readonly entry: Entry;
  /** The ID of the date heading, which names the entry. */
  readonly headingId: string;
  readonly language: Language;
  readonly theme: Theme;
  readonly t: TranslationFunction;
}

/**
 * One entry as the reader shows it: the day (and time), the title, and the text as the journal renders it
 * (Markdown, mentions, read-only task boxes, its own pictures where it places them, the other files below),
 * with nothing to edit, tag or count.
 */
export default function ReaderEntry({ entry, headingId, language, theme, t }: ReaderEntryProps) {
  const placed = entry.format === 'markdown' ? placedAttachmentIds(entry.content) : new Set<number>();
  const below = (entry.attachments ?? []).filter((attachment) => !(placed.has(attachment.id) && isImageAttachment(attachment.mimetype)));

  return (
    <article className="entry-reader-entry" aria-labelledby={headingId}>
      <h2 id={headingId} className="entry-reader-date">
        <time dateTime={entry.date.slice(0, 10)}>{formatEntryDay(entry.date, language)}</time>
        {entry.time_of_day && (
          <>
            {', '}
            <time dateTime={entry.time_of_day}>{formatTimeOfDay(entry.time_of_day, language)}</time>
          </>
        )}
      </h2>
      {entry.title && <h3 className="entry-reader-title">{entry.title}</h3>}
      <div className={`entry-reader-text privacy-text${entry.format === 'markdown' ? '' : ' whitespace-pre-wrap'}`}>
        <EntryContentRenderer content={entry.content} format={entry.format} attachments={entry.attachments} theme={theme} t={t} />
      </div>
      {below.length > 0 && <AttachmentDisplay attachments={below} theme={theme} t={t} />}
    </article>
  );
}
