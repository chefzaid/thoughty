import React from 'react';

interface SourceEntryInfo {
    id: number;
    date: string;
    index: number;
}

interface ContentPart {
    type: 'text' | 'reference';
    content?: string;
    date?: string;
    index?: number;
    displayText?: string;
    key: string;
}

interface EntryContentRendererProps {
    readonly content: string;
    readonly onNavigateToEntry?: (date: string, index: number, sourceEntry?: SourceEntryInfo) => void;
    readonly sourceEntry?: SourceEntryInfo;
    readonly maxLength?: number;
}

/**
 * Parses entry content for cross-reference patterns and renders them as clickable links.
 * Patterns supported:
 * - "entry (yyyy-mm-dd)" - Links to first entry on that date
 * - "entry (yyyy-mm-dd--X)" - Links to entry #X on that date (index inside parenthesis)
 */
const EntryContentRenderer: React.FC<EntryContentRendererProps> = ({ 
    content, 
    onNavigateToEntry, 
    sourceEntry,
    maxLength 
}) => {
    // Regex to match "entry (yyyy-mm-dd)" or "entry (yyyy-mm-dd--X)" with index INSIDE parenthesis
    const referencePattern = /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/gi;

    const parseContent = (): ContentPart[] | null => {
        if (!content) return null;

        // Apply maxLength truncation if specified
        const displayContent = maxLength && content.length > maxLength 
            ? content.slice(0, maxLength) + '...' 
            : content;

        const parts: ContentPart[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let partIndex = 0;

        // Reset regex lastIndex
        referencePattern.lastIndex = 0;

        while ((match = referencePattern.exec(displayContent)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: displayContent.slice(lastIndex, match.index),
                    key: `text-${partIndex++}`
                });
            }

            // Add the reference link
            const date = match[1];
            const index = match[2] ? Number.parseInt(match[2], 10) : 1;
            const displayText = match[0];

            parts.push({
                type: 'reference',
                date,
                index,
                displayText,
                key: `ref-${date}-${index}-${partIndex++}`
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text after last match
        if (lastIndex < displayContent.length) {
            parts.push({
                type: 'text',
                content: displayContent.slice(lastIndex),
                key: `text-${partIndex++}`
            });
        }

        return parts;
    };

    const handleReferenceClick = (date: string, index: number): void => {
        if (onNavigateToEntry) {
            onNavigateToEntry(date, index, sourceEntry);
        }
    };

    const getTitle = (date: string, index: number): string => {
        const indexSuffix = index > 1 ? ` (#${index})` : '';
        return `Navigate to entry on ${date}${indexSuffix}`;
    };

    const parts = parseContent();

    if (!parts || parts.length === 0) {
        const displayContent = maxLength && content && content.length > maxLength 
            ? content.slice(0, maxLength) + '...' 
            : content;
        return <>{displayContent}</>;
    }

    return (
        <>
            {parts.map((part) => {
                if (part.type === 'text') {
                    return <span key={part.key}>{part.content}</span>;
                }

                if (part.type === 'reference' && part.date && part.displayText) {
                    return (
                        <button
                            key={part.key}
                            type="button"
                            className="entry-reference-link"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReferenceClick(part.date!, part.index || 1);
                            }}
                            title={getTitle(part.date, part.index || 1)}
                        >
                            {part.displayText}
                        </button>
                    );
                }

                return null;
            })}
        </>
    );
};

export default EntryContentRenderer;
