import './StatsMoodPanel.css';
import type { components } from '../../generated/openapi';
import TagBadge from '../TagBadge/TagBadge';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import type { Language } from '../../utils/translations';
import { useQuietMode } from '../QuietMode/quietMode';

type StatsMood = components['schemas']['StatsMoodDto'];
type MoodTag = components['schemas']['StatsMoodTagDto'];

interface StatsMoodTagsProps {
    readonly moods: StatsMood;
    readonly theme?: 'light' | 'dark';
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly tagMetadata?: TagMetadataMap;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    /** Opens the journal filtered to one tag; without it the tags are not links. */
    readonly onOpenJournalTag?: (tag: string) => void;
}

interface MoodTagListProps extends Omit<StatsMoodTagsProps, 'moods'> {
    readonly id: string;
    readonly heading: string;
    readonly tags: MoodTag[];
    readonly quiet: boolean;
}

function MoodTagList({ id, heading, tags, quiet, theme, language, tagMetadata, t, onOpenJournalTag }: MoodTagListProps) {
    return (
        <div className="tone-mood-breakdown">
            <h3 id={id}>{heading}</h3>
            {tags.length > 0 ? (
                <ol className="mood-tags-list" aria-labelledby={id}>
                    {tags.map(({ tag, entries }) => {
                        const badge = <TagBadge tag={tag} metadata={tagMetadata} theme={theme} showHash={false} size="xs" />;
                        return (
                            <li key={tag} className="mood-tags-item">
                                {onOpenJournalTag ? (
                                    <button
                                        type="button"
                                        className="mood-tags-link"
                                        onClick={() => onOpenJournalTag(tag)}
                                        aria-label={t('statsMoodTagsOpen', { tag })}
                                    >
                                        {badge}
                                    </button>
                                ) : badge}
                                {/* Quiet mode keeps the tags in their order and leaves out how many entries each is on */}
                                {!quiet && <span className="mood-tags-count">{pluralPhrase(t, 'statsMoodTagsCount', entries, language)}</span>}
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <p className="mood-tags-none">{t('statsMoodTagsListEmpty')}</p>
            )}
        </div>
    );
}

/**
 * The tags used most on entries with a good mood (4 or 5) and on those with a low one (1 or 2), each
 * list ranked by entries and leaving out tags on a single entry. Hidden until a mood is recorded.
 */
function StatsMoodTags({ moods, ...props }: StatsMoodTagsProps) {
    const quiet = useQuietMode();
    // A server from before the tag lists sends none
    const { goodMoodTags = [], lowMoodTags = [] } = moods;
    if (moods.recordedEntries === 0) return null;
    const { themeClass, t } = props;

    return (
        <section className={`chart-card mood-card ${themeClass}`} aria-labelledby="stats-mood-tags-heading">
            <div className="chart-header tone-mood-header">
                <div>
                    <h2 id="stats-mood-tags-heading">{t('statsMoodTagsTitle')}</h2>
                    <p className="tone-mood-description">{t('statsMoodTagsIntro')}</p>
                </div>
            </div>
            {goodMoodTags.length === 0 && lowMoodTags.length === 0 ? (
                <p className="tone-mood-unavailable">{t('statsMoodTagsEmpty')}</p>
            ) : (
                <div className="tone-mood-breakdowns">
                    <MoodTagList {...props} id="stats-mood-tags-good" heading={t('moodFilterHigh')} tags={goodMoodTags} quiet={quiet} />
                    <MoodTagList {...props} id="stats-mood-tags-low" heading={t('moodFilterLow')} tags={lowMoodTags} quiet={quiet} />
                </div>
            )}
        </section>
    );
}

export default StatsMoodTags;
