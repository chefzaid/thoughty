import { useMemo } from 'react';
import { buildSearchHighlightPattern, splitSearchHighlights } from '../../utils/searchHighlight';

interface HighlightedTextProps {
    readonly text: string;
    readonly searchTerm?: string;
    /** The words and phrases of the entry that matched the search, from the server. */
    readonly searchMatches?: readonly string[];
}

/** One line of plain text, such as an entry title, with its search matches marked. */
export default function HighlightedText({ text, searchTerm, searchMatches }: HighlightedTextProps) {
    const segments = useMemo(() => {
        const pattern = buildSearchHighlightPattern(searchTerm, searchMatches);
        return pattern ? splitSearchHighlights(text, pattern) : [{ text, marked: false }];
    }, [searchMatches, searchTerm, text]);

    return (
        <>
            {segments.map((segment, index) => (segment.marked
                ? <mark key={`${index}-${segment.text}`} className="bg-yellow-300 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">{segment.text}</mark>
                : segment.text))}
        </>
    );
}
