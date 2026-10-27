import type { LifeEra } from '../../services/api';
import type { Theme, TranslationFunction } from '../../types';
import { formatCalendarMonth, type CalendarMonth } from '../../utils/calendarMonth';
import { eraLabel, formatEraRange } from '../../utils/lifeEras';
import type { Language } from '../../utils/translations';

interface CalendarEraBannerProps {
  readonly era: LifeEra;
  readonly shown: CalendarMonth;
  readonly onGoToStart: () => void;
  readonly language: Language;
  readonly theme: Theme;
  readonly t: TranslationFunction;
}

/** Names the life era the calendar is narrowed to, with a way back to its first month when the one shown is outside it. */
function CalendarEraBanner({ era, shown, onGoToStart, language, theme, t }: CalendarEraBannerProps) {
  const isLight = theme === 'light';
  const month = formatCalendarMonth(shown);
  const outside = month < era.startDate.slice(0, 7) || (era.endDate !== null && month > era.endDate.slice(0, 7));
  const name = eraLabel(era);

  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${isLight
        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
        : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-100'}`}
    >
      <p>
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
          style={{ backgroundColor: era.color ?? 'currentColor' }}
        />
        {t('calendarEraShowing', { name, range: formatEraRange(era, language, t) })}
      </p>
      {outside && (
        <button
          type="button"
          className="font-medium underline"
          onClick={onGoToStart}
        >
          {t('calendarEraGoToStart', { name: era.name })}
        </button>
      )}
    </div>
  );
}

export default CalendarEraBanner;
