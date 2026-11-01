import { Link } from 'react-router-dom';

import HighlightCard from './HighlightCard';
import './PersonDatesSection.css';
import type { components } from '../../generated/openapi';
import { useQuietMode } from '../QuietMode/quietMode';
import { personJournalPath } from '../../utils/mentions';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

type PersonOfTheDay = components['schemas']['PersonDateHighlightDto'];
type Entry = components['schemas']['EntryResponseDto'];

interface PersonDatesSectionProps {
    readonly people: PersonOfTheDay[];
    readonly language: Language;
    readonly formatDate: (dateStr: string) => string;
    readonly onSelectEntry: (entry: Entry) => void;
    /** Closes Highlights as a person's link opens their entries. */
    readonly onOpenPerson: () => void;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The birthdays and anniversaries of the writer's day, in Highlights after the capsules opened lately: each
 * person links to their entries, with how many mention them and the most recent one. The age or the years
 * an anniversary marks are left out in quiet mode.
 */
export default function PersonDatesSection({ people, language, formatDate, onSelectEntry, onOpenPerson, t }: PersonDatesSectionProps) {
    const quietMode = useQuietMode();

    return (
        <div className="highlight-section person-dates">
            <h3 className="section-title">
                <span className="codicon codicon-gift" aria-hidden="true" />
                {t('personDatesHighlightsTitle')}
            </h3>
            <ul className="person-date-list">
                {people.map((person) => {
                    const years = !quietMode && person.years !== null && person.years > 0
                        ? pluralPhrase(t, person.date.kind === 'birthday' ? 'personDateAge' : 'personDateYears', person.years, language)
                        : null;
                    return (
                        <li key={person.id} className="person-date">
                            <p className="person-date-heading">
                                <Link
                                    to={personJournalPath(person.id)}
                                    className="person-date-name"
                                    aria-label={t('personMentionTitle', { name: person.name })}
                                    onClick={onOpenPerson}
                                >
                                    {person.name}
                                </Link>
                                <span className="person-date-kind"> · {t(`personDateKind_${person.date.kind}`)}</span>
                                {years && <span className="person-date-years"> · {years}</span>}
                            </p>
                            <p className="person-date-count">
                                {person.entryCount > 0
                                    ? pluralPhrase(t, 'personDateMentions', person.entryCount, language, { name: person.name })
                                    : t('personDateNoMentions', { name: person.name })}
                            </p>
                            {person.latestEntry && (
                                <>
                                    <p className="person-date-latest">{t('personDateLatestEntry')}</p>
                                    <HighlightCard
                                        entry={person.latestEntry}
                                        formattedDate={formatDate(person.latestEntry.date)}
                                        maxLength={200}
                                        compact
                                        onOpen={() => person.latestEntry && onSelectEntry(person.latestEntry)}
                                    />
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
