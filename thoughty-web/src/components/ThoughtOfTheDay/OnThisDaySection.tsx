import HighlightCard from './HighlightCard';
import './OnThisDaySection.css';
import type { components } from '../../generated/openapi';

type Entry = components['schemas']['EntryResponseDto'];

/** The Highlights entries written on this day in earlier years, grouped by how many years ago. */
export default function OnThisDaySection({
    onThisDay,
    t,
    formatDate,
    onSelectEntry,
}: Readonly<{
    onThisDay: Record<string, Entry[]>;
    t: (key: string, params?: Record<string, string | number>) => string;
    formatDate: (dateStr: string) => string;
    onSelectEntry: (entry: Entry) => void;
}>) {
    const sortedYears = Object.keys(onThisDay).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

    return (
        <div className="highlight-section on-this-day">
            <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {t('onThisDay')}
            </h3>
            <div className="on-this-day-entries">
                {sortedYears.map((yearsAgo) => (
                    <div key={yearsAgo} className="year-group">
                        <div className="year-badge">
                            {t('yearsAgo', { years: yearsAgo })}
                        </div>
                        {(onThisDay[yearsAgo] ?? []).map((entry) => (
                            <HighlightCard
                                key={entry.id}
                                entry={entry}
                                formattedDate={formatDate(entry.date)}
                                maxLength={200}
                                compact
                                onOpen={() => onSelectEntry(entry)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
