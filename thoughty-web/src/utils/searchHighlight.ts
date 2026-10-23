const WORD_CHARACTER = String.raw`[\p{L}\p{N}]`;

function escapeRegExp(value: string): string {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * The pattern that marks search matches in an entry. With `matches` from the server (the words
 * and phrases of that entry that matched, as written), only whole words are marked, so a match
 * for "run" leaves "brunch" alone and a phrase is marked where the phrase appears. Without them
 * (a search of symbols the server matched literally), the typed text is marked wherever it appears.
 */
export function buildSearchHighlightPattern(
    searchTerm: string | undefined,
    matches: readonly string[] | undefined,
): RegExp | null {
    const typed = searchTerm?.trim() ?? '';
    if (!typed) {
        return null;
    }

    const terms = matches ?? [typed];
    const sources = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
        .sort((left, right) => right.length - left.length)
        .map((term) => term.split(/\s+/).map(escapeRegExp).join(String.raw`\s+`));
    if (sources.length === 0) {
        return null;
    }

    const alternatives = `(?:${sources.join('|')})`;
    const source = matches
        ? `(?<!${WORD_CHARACTER})${alternatives}(?!${WORD_CHARACTER})`
        : alternatives;
    return new RegExp(source, 'giu');
}

/** Splits text into plain segments and the segments the pattern marks. */
export function splitSearchHighlights(text: string, pattern: RegExp): Array<{ text: string; marked: boolean }> {
    const segments: Array<{ text: string; marked: boolean }> = [];
    let lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
        if (match[0] === '') {
            continue;
        }
        if (match.index > lastIndex) {
            segments.push({ text: text.slice(lastIndex, match.index), marked: false });
        }
        segments.push({ text: match[0], marked: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        segments.push({ text: text.slice(lastIndex), marked: false });
    }
    return segments;
}
