import type { Entry, TranslationFunction } from '../../types';
import { locationLabel } from '../../utils/entryLocation';

/** The place an entry was written, by its name or else its coordinates; nothing without one. */
export default function EntryLocationBadge({
  entry,
  isDark,
  language,
  t,
}: Readonly<{ entry: Pick<Entry, 'location'>; isDark: boolean; language: string; t: TranslationFunction }>) {
  const label = locationLabel(entry.location, language, t);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}
    >
      <span className="codicon codicon-location" aria-hidden="true" />
      <span className="sr-only">{t('entryLocationLabel')}: </span>
      <span className="privacy-text">{label}</span>
    </span>
  );
}
