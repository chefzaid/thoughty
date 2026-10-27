import type { Theme, TranslationFunction } from '../../types';
import type { JournalLayout } from './useJournalLayoutRoute';

interface JournalLayoutSwitchProps {
  readonly layout: JournalLayout;
  readonly onChange: (layout: JournalLayout) => void;
  readonly theme: Theme;
  readonly t: TranslationFunction;
}

const LAYOUTS = [
  { value: 'list', labelKey: 'journalLayoutList', icon: 'codicon-list-unordered' },
  { value: 'calendar', labelKey: 'journalLayoutCalendar', icon: 'codicon-calendar' },
] as const;

/** Shows the journal as the entry list or as a month calendar. */
function JournalLayoutSwitch({ layout, onChange, theme, t }: JournalLayoutSwitchProps) {
  const isLight = theme === 'light';
  return (
    <fieldset
      className={`journal-layout-switch flex h-9 shrink-0 overflow-hidden rounded-md border ${isLight ? 'border-gray-300' : 'border-gray-700'}`}
      aria-label={t('journalLayout')}
    >
      {LAYOUTS.map(({ value, labelKey, icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={layout === value}
          onClick={() => { if (layout !== value) onChange(value); }}
          className={`inline-flex h-full items-center gap-2 px-3 text-sm font-medium ${layout === value
            ? 'bg-blue-600 text-white'
            : isLight ? 'bg-gray-50 text-gray-700 hover:bg-gray-100' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}
        >
          <span className={`codicon ${icon}`} aria-hidden="true" />
          {t(labelKey)}
        </button>
      ))}
    </fieldset>
  );
}

export default JournalLayoutSwitch;
