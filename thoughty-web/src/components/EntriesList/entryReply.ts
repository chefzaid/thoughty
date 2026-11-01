import type { Entry, TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatJournalDate, writersToday } from '../../utils/entryDate';
import { extractDate } from './EntriesList.utils';
import { splitGraphemes, toCardText } from '../ShareImageCard/shareCardLayout';

/** About how long a reply's quote may be, in characters, before it is cut on a word. */
export const REPLY_QUOTE_LENGTH = 200;

const ELLIPSIS = '…';
// A sentence ends with . ! ? or … (and any closing quote or bracket), then a space or the end
const FIRST_SENTENCE = /^.*?[.!?…]+["'’”»)\]]*(?=\s|$)/u;
const PLAIN_QUOTE_MARKS: Record<Language, readonly [string, string]> = {
  en: ['“', '”'],
  fr: ['« ', ' »'],
};

/** What a reply starts with in the new entry form. */
export interface EntryReplyDraft {
  readonly text: string;
  readonly format: 'plain' | 'markdown';
}

/** Cuts text to about `length` characters on a word, never inside one, and ends it with an ellipsis. */
function cutOnWord(text: string, length: number): string {
  const graphemes = splitGraphemes(text);
  if (graphemes.length <= length) {
    return text;
  }

  const head = graphemes.slice(0, length + 1).join('');
  const lastSpace = head.search(/\s\S*$/u);
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : graphemes.slice(0, length).join('');
  return `${cut.replace(/[\s,;:.\-–—]+$/u, '')}${ELLIPSIS}`;
}

/**
 * The short quote a reply opens with: the entry's first sentence, or its first REPLY_QUOTE_LENGTH or
 * so characters cut on a word. Markdown syntax, task boxes and entry links are dropped first (as on a
 * share card), so the reply links to this entry only and never to the ones it mentions.
 */
export function replyQuote(content: string, format: 'plain' | 'markdown' = 'plain'): string {
  const firstParagraph = toCardText(content, format).split('\n')[0] ?? '';
  const sentence = FIRST_SENTENCE.exec(firstParagraph)?.[0] ?? firstParagraph;
  return cutOnWord(sentence, REPLY_QUOTE_LENGTH);
}

/** The `[[date#n]]` link to an entry, which its backlinks are found by. */
export function entryReference(entry: Pick<Entry, 'date' | 'index'>): string {
  return `[[${extractDate(entry.date)}#${entry.index ?? 1}]]`;
}

/**
 * Whether **Write a reply** is offered on an entry: one dated before the writer's today (a reply goes
 * on today, so an entry of today is still being written, not looked back on), and not a sealed time
 * capsule, whose text is not readable yet.
 */
export function canReplyToEntry(entry: Pick<Entry, 'date' | 'sealed_until'>, now: Date = new Date()): boolean {
  return !entry.sealed_until && extractDate(entry.date) < writersToday(now);
}

/** The accessible name of **Write a reply**, which names the entry by its date (and number, on a day of several). */
export function replyLabel(entry: Pick<Entry, 'date' | 'index'>, language: Language, t: TranslationFunction): string {
  const date = formatJournalDate(extractDate(entry.date), language);
  const index = entry.index ?? 1;
  return index > 1 ? t('writeReplyToNumberedEntry', { date, index }) : t('writeReplyToEntry', { date });
}

/**
 * The text **Write a reply** puts in the new entry form: a short quote of the entry and a link to it,
 * then an empty line to write on. A Markdown entry is quoted as a blockquote, the link below it (an
 * entry link inside a blockquote would split it); a plain one in the writer's quotation marks.
 * A sealed time capsule gives nothing.
 */
export function entryReplyDraft(
  entry: Pick<Entry, 'content' | 'date' | 'index' | 'format' | 'sealed_until'>,
  language: Language,
): EntryReplyDraft | null {
  if (entry.sealed_until) {
    return null;
  }

  const format = entry.format ?? 'plain';
  const quote = replyQuote(entry.content, format);
  const reference = entryReference(entry);
  if (!quote) {
    return { text: `${reference}\n\n`, format };
  }
  if (format === 'markdown') {
    return { text: `> ${quote}\n\n— ${reference}\n\n`, format };
  }
  const [open, close] = PLAIN_QUOTE_MARKS[language];
  return { text: `${open}${quote}${close} — ${reference}\n\n`, format };
}
