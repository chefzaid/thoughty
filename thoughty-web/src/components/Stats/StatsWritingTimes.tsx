import { useId, useState } from 'react';
import './StatsWritingTimes.css';
import type { components } from '../../generated/openapi';
import type { TranslationFunction } from '../../types';
import { hourName, weekdayName } from '../../utils/calendarNames';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { useQuietMode } from '../QuietMode/quietMode';

type WritingTimes = components['schemas']['StatsWritingTimesDto'];

interface StatsWritingTimesProps {
    readonly writingTimes: WritingTimes;
    /** The writer's time zone, which the API read the creation times in. */
    readonly timeZone: string;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
}

interface Slot {
    readonly label: string;
    readonly count: number;
}

/** The hours on the axis under the hour bars. */
const HOUR_TICKS = [0, 6, 12, 18];

/** How often a slot was written in, against the most written one, in words rather than numbers. */
function writingLevelKey(count: number, max: number): string {
    if (count === 0 || max === 0) return 'statsWritingTimesLevelNone';
    const share = count / max;
    if (share > 2 / 3) return 'statsWritingTimesLevelMost';
    if (share > 1 / 3) return 'statsWritingTimesLevelOften';
    return 'statsWritingTimesLevelSometimes';
}

/** The first slot written in most. */
function busiest(slots: readonly Slot[]): Slot {
    return slots.reduce((best, slot) => (slot.count > best.count ? slot : best), slots[0]!);
}

/**
 * The hours of the day and days of the week the writer writes most, in their time zone. Bars are drawn
 * against the busiest hour or day, so they show the rhythm, not how much is written; quiet mode keeps
 * them and says how often in words instead of counts. A switch shows the same as two tables.
 */
function StatsWritingTimes({ writingTimes, timeZone, themeClass, language, t }: StatsWritingTimesProps) {
    const quiet = useQuietMode();
    const id = useId();
    const headingId = `${id}-heading`;
    const [showTable, setShowTable] = useState(false);
    const hours: Slot[] = writingTimes.hours.map((count, hour) => ({ label: hourName(hour, language), count }));
    // The list is Monday first; weekdayName counts from Sunday
    const weekdays: Slot[] = writingTimes.weekdays.map((count, index) => ({ label: weekdayName((index + 1) % 7, language), count }));
    const maxHour = Math.max(0, ...writingTimes.hours);
    const maxWeekday = Math.max(0, ...writingTimes.weekdays);
    const hasEntries = maxHour > 0;

    const level = (slot: Slot, max: number) => t(writingLevelKey(slot.count, max));
    const describe = (slot: Slot, max: number) => (quiet
        ? t('statsWritingTimesLevelValue', { label: slot.label, level: level(slot, max) })
        : pluralPhrase(t, 'statsChartValue', slot.count, language, { label: slot.label }));
    const height = (count: number, max: number) => `${max > 0 ? (count / max) * 100 : 0}%`;

    const table = (slots: readonly Slot[], max: number, labelHeader: string, caption: string) => (
        <table className="tag-table chart-data-table">
            <caption className="writing-times-caption">{caption}</caption>
            <thead>
                <tr>
                    <th scope="col">{labelHeader}</th>
                    <th scope="col">{quiet ? t('statsWritingTimesHowOften') : t('entries')}</th>
                </tr>
            </thead>
            <tbody>
                {slots.map((slot) => (
                    <tr key={slot.label}>
                        <th scope="row">{slot.label}</th>
                        <td>{quiet ? level(slot, max) : slot.count.toLocaleString(language)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <section className={`chart-card writing-times-card ${themeClass}`} aria-labelledby={headingId}>
            <div className="chart-header tone-mood-header">
                <div>
                    <h2 id={headingId}>{t('statsWritingTimesTitle')}</h2>
                    <p className="tone-mood-description">{t('statsWritingTimesIntro', { zone: timeZone })}</p>
                </div>
                {hasEntries && (
                    <button
                        type="button"
                        className={`chart-view-toggle ${themeClass}`}
                        aria-pressed={showTable}
                        onClick={() => setShowTable((shown) => !shown)}
                    >
                        {t('statsChartTableToggle')}
                    </button>
                )}
            </div>

            {hasEntries ? (
                <>
                    <p className="writing-times-summary">
                        {t('statsWritingTimesSummary', { hour: busiest(hours).label, weekday: busiest(weekdays).label })}
                    </p>
                    {showTable ? (
                        <div className="tone-mood-breakdowns">
                            {table(hours, maxHour, t('statsWritingTimesHour'), t('statsWritingTimesByHour'))}
                            {table(weekdays, maxWeekday, t('statsWritingTimesWeekday'), t('statsWritingTimesByWeekday'))}
                        </div>
                    ) : (
                        <div className="tone-mood-breakdowns">
                            <div className="tone-mood-breakdown">
                                <h3>{t('statsWritingTimesByHour')}</h3>
                                <div
                                    className="writing-times-hours"
                                    role="img"
                                    aria-label={t('statsWritingTimesHoursChart', {
                                        hours: hours.filter((slot) => slot.count > 0).map((slot) => describe(slot, maxHour)).join('; '),
                                    })}
                                >
                                    {hours.map((slot) => (
                                        <span key={slot.label} className="writing-times-hour" title={describe(slot, maxHour)}>
                                            <span className="writing-times-hour-fill" style={{ height: height(slot.count, maxHour) }} />
                                        </span>
                                    ))}
                                </div>
                                <ol className="writing-times-ticks" aria-hidden="true">
                                    {HOUR_TICKS.map((hour) => <li key={hour}>{hours[hour]?.label}</li>)}
                                </ol>
                            </div>
                            <div className="tone-mood-breakdown">
                                <h3>{t('statsWritingTimesByWeekday')}</h3>
                                <ul className="tone-mood-list">
                                    {weekdays.map((slot) => (
                                        <li key={slot.label} className="tone-mood-list-item">
                                            <div className="tone-mood-list-labels">
                                                <span aria-hidden="true">{slot.label}</span>
                                                {!quiet && <span aria-hidden="true">{slot.count.toLocaleString(language)}</span>}
                                            </div>
                                            <span className="sr-only">{describe(slot, maxWeekday)}</span>
                                            <span className="tone-mood-bar-track" aria-hidden="true">
                                                <span className="tone-mood-bar-fill writing-times-weekday-fill" style={{ width: height(slot.count, maxWeekday) }} />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <p className="tone-mood-unavailable">{t('statsWritingTimesEmpty')}</p>
            )}
        </section>
    );
}

export default StatsWritingTimes;
