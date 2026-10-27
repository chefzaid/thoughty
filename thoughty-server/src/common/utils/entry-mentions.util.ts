/**
 * People mentions in entry text: `@Marie`, `@Jean-Paul`, `@élodie_b`.
 *
 * - A handle starts with a letter of any script, goes on with letters, combining marks and digits,
 *   and may join parts with a single `-` or `_` followed by a letter or digit. It holds at most
 *   {@link MENTION_HANDLE_MAX_LENGTH} characters; a longer run is not a mention.
 * - The `@` must not follow a letter, digit, mark or one of `. @ / \ + - \``, so e-mail addresses
 *   (`marie@example.com`), profile URLs (`site.com/@marie`) and an escaped `\@marie` stay text.
 * - The handle must not be followed by `@`, nor by `.`, `-` or `_` and a letter or digit, so a domain
 *   such as `@example.com` is not read as `@example`.
 * - Fenced code blocks, inline code spans, `[[date]]` cross-references, Markdown links and images
 *   (`[text](url)`), autolinks (`<https://…>`) and bare web addresses are left out, in plain and Markdown entries alike.
 *
 * Handles are compared case-insensitively: the key is the NFC form in lower case (`@Marie` and
 * `@marie` are the same person, `@Élodie` and `@Elodie` are not).
 *
 * The web app holds the same rules in `thoughty-web/src/utils/mentions.ts`; change both together. The people
 * migration keeps its own frozen copy (`src/database/migrations/frozen/1786665600000-people-mentions.ts`),
 * which stays as it is: existing entries that must follow a new rule need a new migration.
 */
export const MENTION_HANDLE_MAX_LENGTH = 50;

const MENTION_PATTERN =
  /(?<![\p{L}\p{M}\p{N}.@/\\+`-])@([\p{L}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{M}\p{N}]+)*)(?![\p{L}\p{M}\p{N}@]|[.\-_][\p{L}\p{M}\p{N}])/gu;

/** Text where no mention is read, as patterns over the whole content. */
const EXCLUDED_PATTERNS: readonly RegExp[] = [
  // Fenced code blocks, up to the closing fence or the end of the text
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm,
  // Inline code spans, closed by a run of as many backticks
  /(`+)[\s\S]*?\1/g,
  /\[\[[^\]\n]*\]\]/g,
  /!?\[[^\]\n]*\]\([^)\n]*\)/g,
  /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
  /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
];

export interface MentionMatch {
  /** The case-insensitive key: the handle's NFC form in lower case. */
  readonly handle: string;
  /** The handle as written, without the `@`. */
  readonly written: string;
  /** Where the `@` is in the content. */
  readonly start: number;
  /** Just after the handle. */
  readonly end: number;
}

/** The case-insensitive key of a handle (written with or without its `@`). */
export function normalizeMentionHandle(handle: string): string {
  return handle.replace(/^@/, '').normalize('NFC').toLowerCase();
}

/** The content with every excluded part (code, links, cross-references) blanked out, keeping each position. */
function maskExcludedText(content: string): string {
  let masked = content;
  for (const pattern of EXCLUDED_PATTERNS) {
    masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
  }
  return masked;
}

/** Every mention in the content, in order, including repeats. */
export function findMentions(content: string): MentionMatch[] {
  if (!content || !content.includes('@')) {
    return [];
  }
  const masked = maskExcludedText(content);
  const mentions: MentionMatch[] = [];
  for (const match of masked.matchAll(MENTION_PATTERN)) {
    const written = match[1];
    const handle = normalizeMentionHandle(written);
    // Lower case can lengthen a handle (`İ` becomes two characters), so both forms are measured
    if (written.length > MENTION_HANDLE_MAX_LENGTH || handle.length > MENTION_HANDLE_MAX_LENGTH) {
      continue;
    }
    const start = match.index;
    mentions.push({ handle, written, start, end: start + 1 + written.length });
  }
  return mentions;
}

/** The distinct people an entry mentions, each by its key with the way it was first written, in order. */
export function extractMentionHandles(content: string): Array<{ handle: string; written: string }> {
  const seen = new Map<string, string>();
  for (const { handle, written } of findMentions(content)) {
    if (!seen.has(handle)) {
      seen.set(handle, written);
    }
  }
  return [...seen].map(([handle, written]) => ({ handle, written }));
}
