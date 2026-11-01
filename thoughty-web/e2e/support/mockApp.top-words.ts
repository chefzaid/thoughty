interface WordsEntry {
  date: string;
  content: string;
  capsule?: { openedAt: string | null };
}

/** A few of the common words the API leaves out (`thoughty-server/src/modules/stats/stats-stop-words.ts`). */
const STOP_WORDS = new Set([
  'a', 'about', 'after', 'again', 'and', 'at', 'in', 'is', 'it', 'my', 'of', 'the', 'to', 'was', 'with',
  'au', 'dans', 'de', 'du', 'est', 'et', 'la', 'le', 'les', 'sous', 'un', 'une',
]);

/**
 * A small stand-in for the API's words used most (`stats-words.ts`): the words of the month's entries up to
 * `today`, in lower case, without links, addresses, @mentions, numbers, French elisions and common words,
 * used at least twice, ten at most, most used first then alphabetically. A sealed capsule keeps no text there.
 */
export function buildMockTopWords(entries: WordsEntry[], today: string) {
  const month = today.slice(0, 7);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.date.startsWith(month) || entry.date > today || (entry.capsule && !entry.capsule.openedAt)) continue;
    const text = entry.content
      .replaceAll(/\[\[[^\]\n]*\]\]|\bhttps?:\/\/\S+|@\p{L}[\p{L}\p{N}_-]*/gu, ' ')
      .toLocaleLowerCase(['en', 'fr'])
      .replaceAll('’', "'");
    for (const [token] of text.matchAll(/[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}\p{N}]+)*/gu)) {
      const word = token.replace(/^(?:qu|[cdjlmnst])'/, '').replace(/'s$/, '');
      if (word.length < 2 || /\p{N}/u.test(word) || STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const words = [...counts]
    .filter(([, count]) => count >= 2)
    .sort(([leftWord, left], [rightWord, right]) => right - left || leftWord.localeCompare(rightWord, ['en', 'fr']))
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
  return { month, words };
}
