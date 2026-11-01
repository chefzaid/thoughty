import { useId } from 'react';
import './StatsRecords.css';
import type { components } from '../../generated/openapi';
import type { TranslationFunction } from '../../types';
import { longDayName, longDaySpan } from '../../utils/calendarNames';
import { formatTimeOfDay } from '../../utils/entryTime';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { useQuietMode } from '../QuietMode/quietMode';

type Records = components['schemas']['StatsRecordsDto'];
type RecordEntry = components['schemas']['StatsRecordEntryDto'];

interface StatsRecordsProps {
    readonly records: Records;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
    /** Opens one entry through its permalink. */
    readonly onOpenEntry?: (entryId: number) => void;
    /** Opens the journal on one day. */
    readonly onOpenJournalDay?: (date: string) => void | Promise<void>;
}

interface RecordItem {
    readonly key: string;
    readonly icon: string;
    readonly title: string;
    readonly value: string;
    /** What the link shows; with the title, it names the link. */
    readonly linkText: string;
    readonly onOpen?: () => void;
}

/**
 * The writer's personal records, each a link to the entry or day that set it. Quiet mode leaves out the
 * records that measure how much is written (the longest entry, the busiest day, the longest streak) and
 * keeps those that only say when: the earliest and latest hour, and the first entry.
 */
function StatsRecords({ records, themeClass, language, t, onOpenEntry, onOpenJournalDay }: StatsRecordsProps) {
    const quiet = useQuietMode();
    const id = useId();
    const headingId = `${id}-heading`;

    const openEntry = (entry: RecordEntry) => (onOpenEntry ? () => onOpenEntry(entry.entryId) : undefined);
    const openDay = (date: string) => (onOpenJournalDay ? () => void onOpenJournalDay(date) : undefined);
    const entryItem = (key: string, icon: string, title: string, value: string, entry: RecordEntry, linkText?: string): RecordItem => {
        const date = longDayName(entry.date, language);
        return {
            key,
            icon,
            title,
            value,
            linkText: linkText ?? t('statsRecordsEntryOn', { date, index: entry.index }),
            onOpen: openEntry(entry),
        };
    };

    const items: RecordItem[] = [];
    if (!quiet && records.longestEntry) {
        const { words } = records.longestEntry;
        items.push(entryItem('longest', 'book', t('statsRecordsLongestEntry'), pluralPhrase(t, 'statsRecordsWords', words, language), records.longestEntry));
    }
    if (!quiet && records.busiestDay) {
        items.push({
            key: 'busiest',
            icon: 'layers',
            title: t('statsRecordsBusiestDay'),
            value: pluralPhrase(t, 'statsRecordsEntries', records.busiestDay.entries, language),
            linkText: longDayName(records.busiestDay.date, language),
            onOpen: openDay(records.busiestDay.date),
        });
    }
    if (!quiet && records.longestStreak) {
        const { days, startDate, endDate } = records.longestStreak;
        items.push({
            key: 'streak',
            icon: 'flame',
            title: t('statsRecordsLongestStreak'),
            value: pluralPhrase(t, 'statsRecordsDays', days, language),
            // The streak opens on its first day
            linkText: longDaySpan(startDate, endDate, language),
            onOpen: openDay(startDate),
        });
    }
    if (records.earliestEntry) {
        const { time } = records.earliestEntry;
        items.push(entryItem('earliest', 'lightbulb', t('statsRecordsEarliest'), formatTimeOfDay(time, language), records.earliestEntry));
    }
    if (records.latestEntry) {
        const { time } = records.latestEntry;
        items.push(entryItem('latest', 'watch', t('statsRecordsLatest'), formatTimeOfDay(time, language), records.latestEntry));
    }
    if (records.firstEntry) {
        const { firstEntry } = records;
        items.push(entryItem('first', 'rocket', t('statsRecordsFirstEntry'), longDayName(firstEntry.date, language), firstEntry, t('statsRecordsReadIt')));
    }

    return (
        <section className={`chart-card records-card ${themeClass}`} aria-labelledby={headingId}>
            <div className="chart-header tone-mood-header">
                <div>
                    <h2 id={headingId}>{t('statsRecordsTitle')}</h2>
                    <p className="tone-mood-description">{t('statsRecordsIntro')}</p>
                </div>
            </div>
            {items.length > 0 ? (
                <ul className="records-list">
                    {items.map((item) => (
                        <li key={item.key} className={`records-item records-item-${item.key}`}>
                            <span className={`codicon codicon-${item.icon} records-icon`} aria-hidden="true" />
                            <div className="records-body">
                                <h3 id={`${id}-${item.key}-title`} className="records-title">{item.title}</h3>
                                <p className="records-value">{item.value}</p>
                                <button
                                    type="button"
                                    className={`records-link ${themeClass}`}
                                    id={`${id}-${item.key}-link`}
                                    aria-labelledby={`${id}-${item.key}-title ${id}-${item.key}-link`}
                                    onClick={item.onOpen}
                                    disabled={!item.onOpen}
                                >
                                    {item.linkText}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="tone-mood-unavailable">{t('statsRecordsEmpty')}</p>
            )}
        </section>
    );
}

export default StatsRecords;
