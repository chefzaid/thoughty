import { useId, type ReactNode } from 'react';

import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';

interface HighlightCardProps {
    readonly entry: {
        readonly date: string;
        readonly content: string;
        readonly format?: 'plain' | 'markdown';
        readonly diary_name?: string;
        readonly diary_icon?: string;
    };
    readonly formattedDate: string;
    readonly maxLength: number;
    readonly compact?: boolean;
    readonly onOpen: () => void;
    readonly children?: ReactNode;
}

/**
 * A clickable entry preview. The date button stretches over the whole card, so the preview
 * content (Markdown, links) is not nested inside a button, and the button is named by the
 * date and the preview text.
 */
function HighlightCard({ entry, formattedDate, maxLength, compact = false, onOpen, children }: HighlightCardProps) {
    const dateId = useId();
    const contentId = useId();

    return (
        <article className={`highlight-card clickable${compact ? ' compact' : ''}`}>
            <div className="entry-meta">
                <button
                    id={dateId}
                    type="button"
                    className="entry-date highlight-card-open"
                    aria-labelledby={`${dateId} ${contentId}`}
                    onClick={onOpen}
                >
                    {formattedDate}
                </button>
                {entry.diary_name && (
                    <span className="entry-diary">
                        {entry.diary_icon} {entry.diary_name}
                    </span>
                )}
            </div>
            <div id={contentId} className="entry-content">
                <EntryContentRenderer content={entry.content} format={entry.format} maxLength={maxLength} />
            </div>
            {children}
        </article>
    );
}

export default HighlightCard;
