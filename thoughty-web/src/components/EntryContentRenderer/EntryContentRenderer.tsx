import React, { Suspense, lazy, useMemo } from 'react';
import type { Components } from 'react-markdown';

const BRACKET_REFERENCE_PATTERN = /\[\[(\d{4}-\d{2}-\d{2})(?:#(\d+))?\]\]/i;
const LEGACY_REFERENCE_PATTERN = /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/i;

interface SourceEntryInfo {
    id: number;
    date: string;
    index: number;
}

interface TextContentPart {
    type: 'text';
    content?: string;
    key: string;
}

interface ReferenceContentPart {
    type: 'reference';
    date: string;
    index: number;
    displayText: string;
    key: string;
}

type ContentPart = TextContentPart | ReferenceContentPart;

interface ReferenceMatch {
    matchText: string;
    date: string;
    index: number;
    startIndex: number;
    endIndex: number;
}

interface EntryContentRendererProps {
    readonly content: string;
    readonly format?: 'plain' | 'markdown';
    readonly onNavigateToEntry?: (date: string, index: number, sourceEntry?: SourceEntryInfo) => void;
    readonly sourceEntry?: SourceEntryInfo;
    readonly maxLength?: number;
    readonly searchTerm?: string;
}

const LazyMarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

function findNextReference(content: string, startIndex: number): ReferenceMatch | null {
    const remainingContent = content.slice(startIndex);
    const bracketMatch = BRACKET_REFERENCE_PATTERN.exec(remainingContent);
    const legacyMatch = LEGACY_REFERENCE_PATTERN.exec(remainingContent);

    const match = [
        bracketMatch && {
            matchText: bracketMatch[0],
            date: bracketMatch[1],
            index: bracketMatch[2] ? Number.parseInt(bracketMatch[2], 10) : 1,
            startIndex: startIndex + bracketMatch.index,
            endIndex: startIndex + bracketMatch.index + bracketMatch[0].length,
        },
        legacyMatch && {
            matchText: legacyMatch[0],
            date: legacyMatch[1],
            index: legacyMatch[2] ? Number.parseInt(legacyMatch[2], 10) : 1,
            startIndex: startIndex + legacyMatch.index,
            endIndex: startIndex + legacyMatch.index + legacyMatch[0].length,
        },
    ]
        .filter((candidate): candidate is ReferenceMatch => candidate !== null)
        .sort((left, right) => left.startIndex - right.startIndex)[0];

    return match ?? null;
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
 * - "[[yyyy-mm-dd]]" - Links to the first entry on that date
 * - "[[yyyy-mm-dd#X]]" - Links to entry #X on that date
 * - "entry (yyyy-mm-dd)" - Legacy compatibility for links created this week
 * - "entry (yyyy-mm-dd--X)" - Legacy compatibility for indexed links created this week
 */
function EntryContentRenderer({ 
    content, 
    format,
    onNavigateToEntry, 
    sourceEntry,
    maxLength,
    searchTerm
}: Readonly<EntryContentRendererProps>) {
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
        let currentIndex = 0;
        let partIndex = 0;

        while (currentIndex < displayContent.length) {
            const nextReference = findNextReference(displayContent, currentIndex);
            if (!nextReference) {
                break;
            }

            // Add text before the match
            if (nextReference.startIndex > currentIndex) {
                parts.push({
                    type: 'text',
                    content: displayContent.slice(currentIndex, nextReference.startIndex),
                    key: `text-${partIndex++}`
                });
            }

            // Add the reference link
            parts.push({
                type: 'reference',
                date: nextReference.date,
                index: nextReference.index,
                displayText: nextReference.matchText,
                key: `ref-${nextReference.date}-${nextReference.index}-${partIndex++}`
            });

            currentIndex = nextReference.endIndex;
        }

        // Add remaining text after last match
        if (currentIndex < displayContent.length) {
            parts.push({
                type: 'text',
                content: displayContent.slice(currentIndex),
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
                <Suspense fallback={<span className="markdown-content">{displayContent}</span>}>
                    <LazyMarkdownRenderer content={displayContent} components={markdownComponents} />
                </Suspense>
            );
        }

        return (
            <>
                {parts.map((part) => {
                    if (part.type === 'text') {
                        return (
                            <Suspense key={part.key} fallback={<span className="markdown-content">{part.content || ''}</span>}>
                                <LazyMarkdownRenderer content={part.content || ''} components={markdownComponents} />
                            </Suspense>
                        );
                    }

                    if (part.type === 'reference') {
                        return (
                            <button
                                key={part.key}
                                type="button"
                                className="entry-reference-link"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleReferenceClick(part.date, part.index);
                                }}
                                title={getTitle(part.date, part.index)}
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

                if (part.type === 'reference') {
                    return (
                        <button
                            key={part.key}
                            type="button"
                            className="entry-reference-link"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReferenceClick(part.date, part.index);
                            }}
                            title={getTitle(part.date, part.index)}
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
