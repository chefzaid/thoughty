import React, { Suspense, lazy, useMemo } from 'react';
import type { Components } from 'react-markdown';
import { buildSearchHighlightPattern, splitSearchHighlights } from '../../utils/searchHighlight';
import { countLinesBefore, findTaskLines } from '../../utils/taskList';
import type { MarkdownTaskList } from './MarkdownRenderer';

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
    /** Where the part starts in the content. */
    start: number;
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
    /** The words and phrases of this entry that matched the search, from the server. */
    readonly searchMatches?: readonly string[];
    /**
     * Ticks a task list item of a Markdown entry, by its line in the content (counted from 0). Without
     * it, as in the feed and other read-only views, task list items show as checkboxes that cannot change.
     */
    readonly onToggleTask?: (line: number, checked: boolean) => void;
}

const LazyMarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

function findNextReference(content: string, startIndex: number): ReferenceMatch | null {
    const remainingContent = content.slice(startIndex);
    const bracketMatch = BRACKET_REFERENCE_PATTERN.exec(remainingContent);
    const legacyMatch = LEGACY_REFERENCE_PATTERN.exec(remainingContent);

    const match = !legacyMatch || (bracketMatch && bracketMatch.index <= legacyMatch.index)
        ? bracketMatch
        : legacyMatch;

    if (!match) {
        return null;
    }

    const [, date, rawIndex] = match;
    if (!date) {
        return null;
    }

    return {
        matchText: match[0],
        date,
        index: rawIndex ? Number.parseInt(rawIndex, 10) : 1,
        startIndex: startIndex + match.index,
        endIndex: startIndex + match.index + match[0].length,
    };
}

function highlightText(text: string, key: string, pattern: RegExp | null): React.ReactNode {
    if (!pattern) return text;
    const segments = splitSearchHighlights(text, pattern);
    if (!segments.some((segment) => segment.marked)) return text;
    return (
        <>
            {segments.map((segment, i) =>
                segment.marked
                    ? <mark key={`${key}-hl-${i}`} className="search-highlight rounded-sm px-0.5">{segment.text}</mark>
                    : segment.text
            )}
        </>
    );
}

function highlightChildren(children: React.ReactNode, keyPrefix: string, pattern: RegExp): React.ReactNode {
    return React.Children.map(children, (child, i) => {
        if (typeof child === 'string') {
            return highlightText(child, `${keyPrefix}-${i}`, pattern);
        }
        return child;
    });
}

function createMarkdownHighlightComponents(pattern: RegExp): Components {
    const hl = (children: React.ReactNode, prefix: string) => highlightChildren(children, prefix, pattern);
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

function parseContentParts(content: string): ContentPart[] | null {
    if (!content) return null;

    const parts: ContentPart[] = [];
    let currentIndex = 0;
    let partIndex = 0;

    while (currentIndex < content.length) {
        const nextReference = findNextReference(content, currentIndex);
        if (!nextReference) {
            break;
        }

        if (nextReference.startIndex > currentIndex) {
            parts.push({
                type: 'text',
                content: content.slice(currentIndex, nextReference.startIndex),
                start: currentIndex,
                key: `text-${partIndex++}`
            });
        }

        parts.push({
            type: 'reference',
            date: nextReference.date,
            index: nextReference.index,
            displayText: nextReference.matchText,
            key: `ref-${nextReference.date}-${nextReference.index}-${partIndex++}`
        });

        currentIndex = nextReference.endIndex;
    }

    if (currentIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.slice(currentIndex),
            start: currentIndex,
            key: `text-${partIndex++}`
        });
    }

    return parts;
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
    searchTerm,
    searchMatches,
    onToggleTask
}: Readonly<EntryContentRendererProps>) {
    const highlightPattern = useMemo(
        () => buildSearchHighlightPattern(searchTerm, searchMatches),
        [searchTerm, searchMatches]
    );
    const markdownComponents = useMemo(
        () => highlightPattern ? createMarkdownHighlightComponents(highlightPattern) : undefined,
        [highlightPattern]
    );

    const displayContent = useMemo(() => (
        maxLength && content && content.length > maxLength
            ? content.slice(0, maxLength) + '...'
            : content
    ), [content, maxLength]);

    const parts = useMemo(() => parseContentParts(displayContent), [displayContent]);
    const taskLines = useMemo(
        () => (format === 'markdown' && onToggleTask ? findTaskLines(content) : null),
        [content, format, onToggleTask]
    );
    const taskListFrom = (start: number): MarkdownTaskList | undefined => (taskLines && onToggleTask
        ? { lineOffset: countLinesBefore(displayContent, start), taskLines, onToggle: onToggleTask }
        : undefined);

    // Without a navigation handler (previews, the public feed) a reference is plain styled text,
    // so it never becomes a dead button or a button nested inside a clickable card.
    const renderReference = (part: ReferenceContentPart) => {
        if (!onNavigateToEntry) {
            return <span key={part.key} className="entry-reference-link">{part.displayText}</span>;
        }

        const indexSuffix = part.index > 1 ? ` (#${part.index})` : '';
        return (
            <button
                key={part.key}
                type="button"
                className="entry-reference-link"
                onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToEntry(part.date, part.index, sourceEntry);
                }}
                title={`Navigate to entry on ${part.date}${indexSuffix}`}
            >
                {part.displayText}
            </button>
        );
    };

    // Markdown rendering mode
    if (format === 'markdown') {
        // For markdown entries, render markdown first, then handle references
        // We still support cross-references inside markdown content
        if (!parts || parts.length === 0) {
            return (
                <Suspense fallback={<span className="markdown-content">{displayContent}</span>}>
                    <LazyMarkdownRenderer content={displayContent} components={markdownComponents} taskList={taskListFrom(0)} />
                </Suspense>
            );
        }

        return (
            <>
                {parts.map((part) => {
                    if (part.type === 'text') {
                        return (
                            <Suspense key={part.key} fallback={<span className="markdown-content">{part.content || ''}</span>}>
                                <LazyMarkdownRenderer content={part.content || ''} components={markdownComponents} taskList={taskListFrom(part.start)} />
                            </Suspense>
                        );
                    }

                    if (part.type === 'reference') {
                        return renderReference(part);
                    }

                    return null;
                })}
            </>
        );
    }

    // Plain text rendering mode (original behavior)
    if (!parts || parts.length === 0) {
        return <>{highlightText(displayContent, 'root', highlightPattern)}</>;
    }

    return (
        <>
            {parts.map((part) => {
                if (part.type === 'text') {
                    return <span key={part.key}>{highlightText(part.content || '', part.key, highlightPattern)}</span>;
                }

                if (part.type === 'reference') {
                    return renderReference(part);
                }

                return null;
            })}
        </>
    );
}

export default EntryContentRenderer;
