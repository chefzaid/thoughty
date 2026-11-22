import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import './ReachOutSection.css';
import type { components } from '../../generated/openapi';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createPeopleService } from '../../services/api';
import { writersToday } from '../../utils/entryDate';
import { formatEraDate } from '../../utils/lifeEras';
import { personJournalPath, PEOPLE_QUERY_KEY } from '../../utils/mentions';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

type ReachOut = components['schemas']['PersonReachOutHighlightDto'];

interface ReachOutSectionProps {
    readonly people: ReachOut[];
    readonly language: Language;
    /** Closes Highlights as a person's link opens their entries. */
    readonly onOpenPerson: () => void;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The people the writer asked to be reminded to reach out to, due on their day, in Highlights after the
 * birthdays and anniversaries: how long since they were last in touch (a recorded contact or an entry that
 * mentions them), and **Contacted today**, which records the day and takes the person off the list.
 */
export default function ReachOutSection({ people, language, onOpenPerson, t }: ReachOutSectionProps) {
    const service = useAuthenticatedService(createPeopleService);
    const queryClient = useQueryClient();
    const [doneIds, setDoneIds] = useState<ReadonlySet<number>>(new Set());
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const shown = people.filter((person) => !doneIds.has(person.id));

    const markContacted = async (person: ReachOut) => {
        if (pendingId !== null) return;
        setPendingId(person.id);
        setError('');
        const result = await service.markContacted(person.id, writersToday());
        setPendingId(null);
        if (!result.data) {
            setError(t(result.error ?? 'reachOutContactFailed'));
            return;
        }
        setDoneIds((current) => new Set(current).add(person.id));
        setAnnouncement(t('reachOutContactedAnnouncement', { name: person.name }));
        void queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEY });
    };

    return (
        <div className="highlight-section reach-outs">
            <p role="status" className="sr-only">{announcement}</p>
            {shown.length > 0 && (
                <>
                    <h3 className="section-title">
                        <span className="codicon codicon-comment-discussion" aria-hidden="true" />
                        {t('reachOutHighlightsTitle')}
                    </h3>
                    {error && <p role="alert" className="reach-out-error">{error}</p>}
                    <ul className="reach-out-list">
                        {shown.map((person) => {
                            const dates = [
                                person.lastContactOn && t('reachOutLastContactShown', { date: formatEraDate(person.lastContactOn, language) }),
                                person.lastMentionedOn && t('reachOutLastMentionedShown', { date: formatEraDate(person.lastMentionedOn, language) }),
                            ].filter(Boolean).join(' · ');
                            return (
                                <li key={person.id} className="reach-out">
                                    <p className="reach-out-heading">
                                        <Link
                                            to={personJournalPath(person.id)}
                                            className="reach-out-name"
                                            aria-label={t('personMentionTitle', { name: person.name })}
                                            onClick={onOpenPerson}
                                        >
                                            {person.name}
                                        </Link>
                                        <span className="reach-out-after">
                                            {' · '}{t('reachOutHighlightAfter', { interval: t(`reachOutAfter_${person.reachOutDays}`) })}
                                        </span>
                                    </p>
                                    <p className="reach-out-since">
                                        {person.daysSince === null
                                            ? t('reachOutNothingOnRecord', { name: person.name })
                                            : pluralPhrase(t, 'reachOutDaysSince', person.daysSince, language)}
                                    </p>
                                    {dates && <p className="reach-out-dates">{dates}</p>}
                                    <button
                                        type="button"
                                        className="reach-out-contacted"
                                        aria-disabled={pendingId === person.id}
                                        aria-label={t('reachOutContactedFor', { name: person.name })}
                                        onClick={() => void markContacted(person)}
                                    >
                                        {t('reachOutContacted')}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
