import { useId } from 'react';
import { Link } from 'react-router-dom';

import type { Person } from '../../services/api/peopleService';
import { getPathForView, type TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import { mutedTextClass } from '../../utils/tintedText';

interface PersonFilterBannerProps {
  readonly person: Person;
  readonly onClear: () => void;
  readonly language: Language;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/** Heads the journal while it shows the entries that mention one person. */
export default function PersonFilterBanner({ person, onClear, language, theme, t }: PersonFilterBannerProps) {
  const titleId = useId();
  const isDark = theme === 'dark';
  const buttonClass = `inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${isDark
    ? 'border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-800'
    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`;

  return (
    <section
      aria-labelledby={titleId}
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${isDark
        ? 'border-violet-500/40 bg-violet-500/10'
        : 'border-violet-300 bg-violet-50'}`}
    >
      <div className="min-w-0">
        <h2 id={titleId} className={`text-lg font-semibold break-words ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          {t('personViewTitle', { name: person.name })}
        </h2>
        <p className={`text-sm ${mutedTextClass(isDark)}`}>
          {[pluralPhrase(t, 'personEntryCount', person.entryCount, language), person.handles.map((handle) => `@${handle}`).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={getPathForView('people')} className={buttonClass}>
          <span className="codicon codicon-organization" aria-hidden="true" />
          {t('personViewAllPeople')}
        </Link>
        <button type="button" onClick={onClear} className={buttonClass}>
          <span className="codicon codicon-close" aria-hidden="true" />
          {t('personViewClear')}
        </button>
      </div>
    </section>
  );
}
