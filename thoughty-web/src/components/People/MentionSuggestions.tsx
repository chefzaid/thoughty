import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import type { MentionSuggestionList } from './useMentionAutocomplete';

interface MentionSuggestionsProps {
    readonly suggestions: MentionSuggestionList | null;
    readonly theme?: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
}

/** The people offered after `@`, under the writing field; the field keeps focus and the keyboard. */
export default function MentionSuggestions({ suggestions, theme, language, t }: MentionSuggestionsProps) {
    const isLight = theme === 'light';
    return (
        <>
            <p className="sr-only" role="status" aria-live="polite">
                {suggestions ? pluralPhrase(t, 'mentionSuggestionsStatus', suggestions.items.length, language) : ''}
            </p>
            {suggestions && (
                <ul
                    id={suggestions.id}
                    role="listbox"
                    aria-label={t('mentionSuggestionsLabel')}
                    className={`absolute left-0 top-full z-30 mt-1 max-h-64 w-full max-w-sm overflow-auto rounded-lg border py-1 shadow-lg ${isLight
                        ? 'border-gray-200 bg-white text-gray-900'
                        : 'border-gray-700 bg-gray-800 text-gray-100'}`}
                >
                    {suggestions.items.map(({ person, handle }, index) => {
                        const selected = index === suggestions.active;
                        return (
                            <li
                                key={person.id}
                                id={suggestions.optionId(index)}
                                role="option"
                                aria-selected={selected}
                                // Choosing with the pointer keeps the caret in the field
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => suggestions.onChoose(index)}
                                onMouseEnter={() => suggestions.onHover(index)}
                                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-sm ${selected
                                    ? (isLight ? 'bg-violet-100 text-violet-900' : 'bg-violet-500/25 text-white')
                                    : ''}`}
                            >
                                <span className="min-w-0 truncate">
                                    <span className="font-medium">{person.name}</span>
                                    <span className={`ml-2 ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>@{handle}</span>
                                </span>
                                <span className={`shrink-0 text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                                    {pluralPhrase(t, 'personEntryCount', person.entryCount, language)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
