import type { MockEntry } from './mockApp.shared';

interface MockSearchTerm {
  text: string;
  negated: boolean;
  prefix: boolean;
}

export interface MockSearchResult {
  score: number;
  matches: string[];
}

const TOKEN = /-?"[^"]*"?|\S+/g;

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Alternatives separated by OR, each a list of words or phrases that must all be present (or absent when negated). */
function parseSearch(search: string): MockSearchTerm[][] {
  const groups: MockSearchTerm[][] = [[]];
  const tokens = search.trim().match(TOKEN) ?? [];
  tokens.forEach((token, index) => {
    if (token.toLowerCase() === 'or') {
      groups.push([]);
      return;
    }
    const negated = token.startsWith('-') && token.length > 1;
    const quoted = token.replace(/^-/, '').startsWith('"');
    const text = token.replace(/^-/, '').replaceAll('"', '').trim();
    if (text) {
      groups.at(-1)?.push({ text, negated, prefix: !negated && !quoted && index === tokens.length - 1 });
    }
  });
  return groups.filter((group) => group.length > 0);
}

function termPattern(term: MockSearchTerm): RegExp {
  const words = term.text.split(/\s+/).map(escapeRegExp).join(String.raw`\s+`);
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}${term.prefix ? String.raw`[\p{L}\p{N}]*` : ''}(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * A small stand-in for the API's full-text search: whole words, "quoted phrases", -exclusions,
 * OR, and the last word matched as a prefix, without stemming. Returns null when the entry does
 * not match, otherwise a score (occurrences) and the matched words as written.
 */
export function matchMockSearch(entry: MockEntry, search: string): MockSearchResult | null {
  const groups = parseSearch(search);
  const tagMatch = entry.tags.includes(search.trim());
  const matchingGroups = groups.filter((group) => group.every((term) => {
    const found = termPattern(term).test(entry.content)
      || termPattern(term).test(entry.title ?? '')
      || entry.tags.some((tag) => termPattern(term).test(tag));
    return term.negated ? !found : found;
  }));
  if (matchingGroups.length === 0 && !tagMatch) {
    return null;
  }

  const matches = matchingGroups
    .flat()
    .filter((term) => !term.negated)
    .flatMap((term) => [...((entry.title ?? '').match(termPattern(term)) ?? []), ...(entry.content.match(termPattern(term)) ?? [])]);
  return { score: matches.length, matches: [...new Set(matches)] };
}
