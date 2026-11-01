import { useId } from 'react';
import './StatsTopWords.css';
import type { components } from '../../generated/openapi';
import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { useQuietMode } from '../QuietMode/quietMode';

type TopWords = components['schemas']['StatsTopWordsDto'];

interface StatsTopWordsProps {
    readonly topWords: TopWords;
    readonly themeClass: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
    /** Opens the journal searched for one word; without it the words are not links. */
    readonly onSearchJournal?: (word: string) => void;
}

/**
 * The words used most in this month's entries, a ranked list without the common English and French
 * words, each one a search of the journal. The words come from entry text, so the privacy blur hides
 * them; quiet mode keeps them in their order without how many times each is used.
 */
function StatsTopWords({ topWords, themeClass, language, t, onSearchJournal }: StatsTopWordsProps) {
    const quiet = useQuietMode();
    const headingId = `${useId()}-heading`;
    const month = monthName(Number(topWords.month.slice(5, 7)), language);

    return (
        <section className={`chart-card top-words-card ${themeClass}`} aria-labelledby={headingId}>
            <div className="chart-header tone-mood-header">
                <div>
                    <h2 id={headingId}>{t('statsTopWordsTitle')}</h2>
                    <p className="tone-mood-description">{t('statsTopWordsIntro', { month })}</p>
                </div>
            </div>
            {topWords.words.length > 0 ? (
                <ol className="top-words-list" aria-labelledby={headingId}>
                    {topWords.words.map(({ word, count }) => (
                        <li key={word} className="top-words-item">
                            {onSearchJournal ? (
                                <button
                                    type="button"
                                    className={`top-words-word top-words-link privacy-text ${themeClass}`}
                                    onClick={() => onSearchJournal(word)}
                                    aria-label={t('statsTopWordsOpen', { word })}
                                >
                                    {word}
                                </button>
                            ) : (
                                <span className="top-words-word privacy-text">{word}</span>
                            )}
                            {!quiet && <span className="top-words-count">{pluralPhrase(t, 'statsTopWordsCount', count, language)}</span>}
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="tone-mood-unavailable">{t('statsTopWordsEmpty')}</p>
            )}
        </section>
    );
}

export default StatsTopWords;
