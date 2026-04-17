import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { useMemo } from 'react';

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
    readonly format?: 'plain' | 'markdown';
    readonly onNavigateToEntry?: (date: string, index: number, sourceEntry?: SourceEntryInfo) => void;
    readonly sourceEntry?: SourceEntryInfo;
    readonly maxLength?: number;
    readonly searchTerm?: string;
}

function escapeRegExp(str: string): string {
    return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function highlightText(text: string, key: string, searchTerm: string): React.ReactNode {
    const escaped = escapeRegExp(searchTerm);
    const searchRegex = new RegExp(`(${escaped})`, 'gi');
    const segments = text.split(searchRegex);
    if (segments.length <= 1) return text;
    return (
        <>
            {segments.map((segment, i) =>
                searchRegex.test(segment)
                    ? <mark key={`${key}-hl-${i}`} className="bg-yellow-300 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">{segment}</mark>
                    : segment
            )}
        </>
    );
}

function highlightChildren(children: React.ReactNode, keyPrefix: string, searchTerm: string): React.ReactNode {
    return React.Children.map(children, (child, i) => {
        if (typeof child === 'string') {
            return highlightText(child, `${keyPrefix}-${i}`, searchTerm);
        }
        return child;
    });
}

function createMarkdownHighlightComponents(searchTerm: string): Components {
    const hl = (children: React.ReactNode, prefix: string) => highlightChildren(children, prefix, searchTerm);
    return {
        p: ({ children, ...props }) => <p {...props}>{hl(children, 'md-p')}</p>,
        li: ({ children, ...props }) => <li {...props}>{hl(children, 'md-li')}</li>,
        strong: ({ children, ...props }) => <strong {...props}>{hl(children, 'md-strong')}</strong>,
        em: ({ children, ...props }) => <em {...props}>{hl(children, 'md-em')}</em>,
        td: ({ children, ...props }) => <td {...props}>{hl(children, 'md-td')}</td>,
        th: ({ children, ...props }) => <th {...props}>{hl(children, 'md-th')}</th>,
        h1: ({ children, ...props }) => <h1 {...props}>{hl(children, 'md-h1')}</h1>,
        h2: ({ children, ...props }) => <h2 {...props}>{hl(children, 'md-h2')}</h2>,
        h3: ({ children, ...props }) => <h3 {...props}>{hl(children, 'md-h3')}</h3>,
    };
}

/**
 * Parses entry content for cross-reference patterns and renders them as clickable links.
 * Patterns supported:
 * - "entry (yyyy-mm-dd)" - Links to first entry on that date
 * - "entry (yyyy-mm-dd--X)" - Links to entry #X on that date (index inside parenthesis)
 */
function EntryContentRenderer({ 
    content, 
    format,
    onNavigateToEntry, 
    sourceEntry,
    maxLength,
    searchTerm
}: Readonly<EntryContentRendererProps>) {
    // Regex to match "entry (yyyy-mm-dd)" or "entry (yyyy-mm-dd--X)" with index INSIDE parenthesis
    const referencePattern = /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/gi;

    const markdownComponents = useMemo(
        () => searchTerm && searchTerm.trim() !== '' ? createMarkdownHighlightComponents(searchTerm) : undefined,
        [searchTerm]
    );

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

    // Apply maxLength truncation for display
    const displayContent = maxLength && content && content.length > maxLength 
        ? content.slice(0, maxLength) + '...' 
        : content;

    // Markdown rendering mode
    if (format === 'markdown') {
        // For markdown entries, render markdown first, then handle references
        // We still support cross-references inside markdown content
        if (!parts || parts.length === 0) {
            return (
                <span className="markdown-content">
                    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{displayContent}</Markdown>
                </span>
            );
        }

        return (
            <>
                {parts.map((part) => {
                    if (part.type === 'text') {
                        return (
                            <span key={part.key} className="markdown-content">
                                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{part.content || ''}</Markdown>
                            </span>
                        );
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
    }

    // Plain text rendering mode (original behavior)
    if (!parts || parts.length === 0) {
        return <>{searchTerm ? highlightText(displayContent, 'root', searchTerm) : displayContent}</>;
    }

    return (
        <>
            {parts.map((part) => {
                if (part.type === 'text') {
                    return <span key={part.key}>{searchTerm ? highlightText(part.content || '', part.key, searchTerm) : part.content}</span>;
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
}

export default EntryContentRenderer;
