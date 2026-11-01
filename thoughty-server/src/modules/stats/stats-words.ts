import { findMentions } from '@/common/utils/entry-mentions.util';
import type { StatsTopWordDto } from './dto';
import { STOP_WORDS } from './stats-stop-words';

/**
 * English and French, the app's two languages, lower and sort words the same way; naming them keeps the
 * server's own locale out (a Turkish one would lower `I` to `ı`).
 */
const WORD_LOCALES = ['en', 'fr'];

/** Parts of an entry that are not words the writer wrote, as patterns over the whole text. */
const NOT_WORDS: readonly RegExp[] = [
  // Fenced code blocks, up to the closing fence or the end of the text
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm,
  // Inline code spans, closed by a run of as many backticks
  /(`+)[\s\S]*?\1/g,
  // `[[2026-11-01#2]]` links between entries
  /\[\[[^\]\n]*\]\]/g,
  // Images, inline ones included (`![alt](attachment:42)`)
  /!\[[^\]\n]*\]\([^)\n]*\)/g,
  // Autolinks and HTML tags
  /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
  /<\/?[a-z][^<>\n]*>/gi,
  /&(?:[a-z]+|#\d+|#x[\da-f]+);/gi,
  /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
  /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,}/gi,
];
/** A Markdown link keeps its text and loses its address. */
const MARKDOWN_LINK = /\[([^\]\n]*)\]\([^)\n]*\)/g;

/** Letters (accents included, as one character or with combining marks) and digits, joined by apostrophes. */
const WORD = /[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}\p{N}]+)*/gu;
/** The typographic apostrophe (`l’été`) and the modifier letter one count as the straight one. */
const APOSTROPHES = /[’ʼ]/g;
/** French elisions at the start of a word: `l’`, `d’`, `j’`, `qu’`, `jusqu’`… */
const ELISION = /^(?:qu|jusqu|lorsqu|puisqu|quoiqu|[cdjlmnst])'/;
/** The English possessive: `writer’s` counts as `writer`. */
const POSSESSIVE = /'s$/;
const DIGIT = /\p{N}/u;

/** Whether a word, as the tokenizer leaves it, is worth counting. */
function isCounted(word: string): boolean {
  return word.length > 1 && !DIGIT.test(word) && !STOP_WORDS.has(word);
}

/** An entry's text without what is not a written word: Markdown syntax, code, links, addresses and @mentions. */
function writtenText(content: string): string {
  let text = content.normalize('NFC');
  // A mention is blanked where it stands, before anything moves the text around it
  for (const mention of findMentions(text).reverse()) {
    text = `${text.slice(0, mention.start)} ${text.slice(mention.end)}`;
  }
  for (const pattern of NOT_WORDS) {
    text = text.replace(pattern, ' ');
  }
  return text.replace(MARKDOWN_LINK, '$1');
}

/**
 * The words of an entry worth counting, in order, as they will be listed: in lower case with their
 * accents, without French elisions (`l’amour` is `amour`) or the English possessive, and without
 * numbers, words of one letter and common English and French words (`stats-stop-words.ts`). Words
 * joined by a hyphen count apart (`peut-être` is `peut` and `être`).
 */
export function entryWords(content: string): string[] {
  const words: string[] = [];
  const text = writtenText(content).toLocaleLowerCase(WORD_LOCALES).replace(APOSTROPHES, "'");
  for (const [token] of text.matchAll(WORD)) {
    // A whole word is checked first, so a common word with an apostrophe (`aujourd'hui`, `don't`) stays out
    if (STOP_WORDS.has(token)) continue;
    const word = token.replace(ELISION, '').replace(POSSESSIVE, '');
    if (isCounted(word)) words.push(word);
  }
  return words;
}

/**
 * The words used most across the texts, with how many times each is used: at least `minimum` times,
 * at most `limit` words, most used first, then in alphabetical order.
 */
export function topWords(contents: Iterable<string>, limit: number, minimum: number): StatsTopWordDto[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    for (const word of entryWords(content)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count >= minimum)
    .sort(([leftWord, left], [rightWord, right]) => right - left || leftWord.localeCompare(rightWord, WORD_LOCALES))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}
