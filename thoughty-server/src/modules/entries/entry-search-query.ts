/** Text search configurations created by the full-text search migration. */
export const ENTRY_SEARCH_CONFIGS = ['thoughty_en', 'thoughty_fr'] as const;

/** At most this many words and phrases are highlighted in each entry. */
const MAX_HIGHLIGHT_TERMS = 10;
const PREFIX_WORD = /^[\p{L}\p{N}]{2,}$/u;
const SEARCH_TOKEN = /-?"[^"]*"?|\S+/g;

export interface EntrySearchTerm {
  /** A word or the words of a quoted phrase, as typed. */
  text: string;
  /** Whether the word also matches the longer words it starts. */
  prefix: boolean;
}

export interface ParsedEntrySearch {
  /** The search as typed, read by `websearch_to_tsquery`. */
  text: string;
  /**
   * The last word, still being typed, matched as the start of a word. `rest` is the search
   * before it and `joinWithOr` tells whether `rest` ended with OR.
   */
  prefix?: { word: string; rest: string; joinWithOr: boolean };
  /** The words and phrases an entry is highlighted for: everything not excluded. */
  terms: EntrySearchTerm[];
}

interface SearchToken {
  value: string;
  start: number;
}

/**
 * Reads a search with the operators of `websearch_to_tsquery`: "quoted phrases", a leading
 * minus to leave a word or phrase out, and OR between alternatives. PostgreSQL parses the
 * search itself; this only finds the last word to match as a prefix and the terms to highlight.
 */
export function parseEntrySearch(input: string): ParsedEntrySearch {
  const text = input.trim();
  const tokens: SearchToken[] = [...text.matchAll(SEARCH_TOKEN)].map((match) => ({
    value: match[0],
    start: match.index,
  }));

  const terms: EntrySearchTerm[] = [];
  for (const { value } of tokens) {
    if (isOrOperator(value) || (value.startsWith('-') && value.length > 1)) {
      continue;
    }
    const term = value.startsWith('"') ? value.replaceAll('"', '').trim() : value;
    if (term) {
      terms.push({ text: term, prefix: false });
    }
  }

  const prefix = findPrefix(text, tokens);
  const lastTerm = terms.at(-1);
  if (prefix && lastTerm?.text === prefix.word) {
    lastTerm.prefix = true;
  }

  return { text, prefix, terms: terms.slice(-MAX_HIGHLIGHT_TERMS) };
}

function findPrefix(text: string, tokens: SearchToken[]): ParsedEntrySearch['prefix'] {
  const last = tokens.at(-1);
  if (!last || !PREFIX_WORD.test(last.value) || isOrOperator(last.value)) {
    return undefined;
  }

  // An unclosed quote before the last word makes it part of a phrase.
  const quotesBefore = text.slice(0, last.start).split('"').length - 1;
  if (quotesBefore % 2 === 1) {
    return undefined;
  }

  const previous = tokens.at(-2);
  const joinWithOr = previous !== undefined && isOrOperator(previous.value);
  const restEnd = joinWithOr ? previous.start : last.start;
  return { word: last.value, rest: text.slice(0, restEnd).trim(), joinWithOr };
}

function isOrOperator(value: string): boolean {
  return value.toLowerCase() === 'or';
}

/** Escapes `%`, `_` and backslashes so a search can be matched literally with ILIKE. */
export function escapeLikePattern(value: string): string {
  return value.replaceAll(/[\\%_]/g, String.raw`\$&`);
}
