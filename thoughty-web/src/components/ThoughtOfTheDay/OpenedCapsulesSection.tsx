import HighlightCard from './HighlightCard';
import './OpenedCapsulesSection.css';
import type { components } from '../../generated/openapi';
import type { Language } from '../../utils/translations';
import { formatTimeCapsuleDay } from '../../utils/timeCapsule';

type OpenedCapsule = components['schemas']['OpenedTimeCapsuleDto'];
type Entry = components['schemas']['EntryResponseDto'];

interface OpenedCapsulesSectionProps {
    readonly capsules: OpenedCapsule[];
    readonly language: Language;
    readonly formatDate: (dateStr: string) => string;
    readonly onSelectEntry: (entry: Entry) => void;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** Time capsules opened in the last week, first in Highlights: each letter with the day it was sealed. */
export default function OpenedCapsulesSection({ capsules, language, formatDate, onSelectEntry, t }: OpenedCapsulesSectionProps) {
    return (
        <div className="highlight-section opened-capsules">
            <h3 className="section-title">
                <span className="codicon codicon-unlock" aria-hidden="true" />
                {t('timeCapsuleHighlightsTitle')}
            </h3>
            {capsules.map(({ entry, sealed_at: sealedAt, opened_early: openedEarly }) => (
                <HighlightCard
                    key={entry.id}
                    entry={entry}
                    formattedDate={formatDate(entry.date)}
                    maxLength={300}
                    onOpen={() => onSelectEntry(entry)}
                >
                    <p className="capsule-meta">
                        {t('timeCapsuleSealedOn', { date: formatTimeCapsuleDay(sealedAt, language) })}
                        {openedEarly && <span className="capsule-early"> · {t('timeCapsuleOpenedEarly')}</span>}
                    </p>
                </HighlightCard>
            ))}
        </div>
    );
}
