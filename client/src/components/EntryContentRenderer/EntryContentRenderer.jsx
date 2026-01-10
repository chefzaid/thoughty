import React from 'react';

/**
 * Parses entry content for cross-reference patterns and renders them as clickable links.
 * Patterns supported:
 * - "entry (yyyy-mm-dd)" - Links to first entry on that date
 * - "entry (yyyy-mm-dd--X)" - Links to entry #X on that date (index inside parenthesis)
 */
const EntryContentRenderer = ({ content, onNavigateToEntry, theme, sourceEntry }) => {
    // Regex to match "entry (yyyy-mm-dd)" or "entry (yyyy-mm-dd--X)" with index INSIDE parenthesis
    const referencePattern = /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/gi;

    const parseContent = () => {
        if (!content) return null;

        const parts = [];
        let lastIndex = 0;
        let match;

        // Reset regex lastIndex
        referencePattern.lastIndex = 0;

        while ((match = referencePattern.exec(content)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: content.slice(lastIndex, match.index)
                });
            }

            // Add the reference link
            const date = match[1];
            const index = match[2] ? parseInt(match[2]) : 1;
            const displayText = match[0];

            parts.push({
                type: 'reference',
                date,
                index,
                displayText
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text after last match
        if (lastIndex < content.length) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex)
            });
        }

        return parts;
    };

    const handleReferenceClick = (date, index) => {
        if (onNavigateToEntry) {
            onNavigateToEntry(date, index, sourceEntry);
        }
    };

    const parts = parseContent();

    if (!parts || parts.length === 0) {
        return <>{content}</>;
    }

    return (
        <>
            {parts.map((part, i) => {
                if (part.type === 'text') {
                    return <span key={i}>{part.content}</span>;
                }

                if (part.type === 'reference') {
                    return (
                        <span
                            key={i}
                            className="entry-reference-link"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReferenceClick(part.date, part.index);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleReferenceClick(part.date, part.index);
                                }
                            }}
                            title={`Navigate to entry on ${part.date}${part.index > 1 ? ` (#${part.index})` : ''}`}
                        >
                            {part.displayText}
                        </span>
                    );
                }

                return null;
            })}
        </>
    );
};

export default EntryContentRenderer;
