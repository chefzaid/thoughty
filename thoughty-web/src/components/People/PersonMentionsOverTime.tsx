import { useId } from 'react';

import type { MentionPeriod } from '../../services/api/peopleService';
import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import { moodEmoji, moodLabelKey, nearestMoodLevel } from '../../utils/entryMood';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import { usePersonMentions, type MentionsScope } from './usePersonMentions';

interface PersonMentionsOverTimeProps {
  readonly scope: MentionsScope;
  /** The person's name shown, or the group's. */
  readonly name: string;
  readonly theme: 'light' | 'dark';
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** "4.5 out of 5 (Good)", or null for a period without a mood. */
function moodText(period: MentionPeriod, language: Language, t: TranslationFunction): string | null {
  if (period.averageMood === null) return null;
  return t('personMentionsMoodValue', {
    average: period.averageMood.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    label: t(moodLabelKey(nearestMoodLevel(period.averageMood))),
  });
}

/**
 * How many entries mention a person, or anyone in a group, in each of the last twelve months (bars drawn against the
 * busiest month, each read out with its count and average mood) and in each year since the first mention, as a table.
 */
export default function PersonMentionsOverTime({ scope, name, theme, language, t }: PersonMentionsOverTimeProps) {
  const mentions = usePersonMentions(scope);
  const titleId = useId();
  const isDark = theme === 'dark';
  const muted = mutedTextClass(isDark);
  const data = mentions.data;
  const busiest = Math.max(1, ...(data?.months ?? []).map((month) => month.entries));
  const lastYear = (data?.months ?? []).reduce((sum, month) => sum + month.entries, 0);
  const monthLabel = (period: string, width: 'long' | 'short') => {
    const month = monthName(Number(period.slice(5, 7)), language, width);
    return width === 'long' ? `${month} ${period.slice(0, 4)}` : month;
  };

  return (
    <section aria-labelledby={titleId} className={`mt-2 grid gap-3 rounded-lg border p-3 ${isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-gray-50'}`}>
      <h2 id={titleId} className="text-sm font-semibold">{t('personMentionsTitle', { name })}</h2>
      {mentions.isPending && <p className={`text-sm ${muted}`}>{t('personMentionsLoading')}</p>}
      {mentions.isError && <p role="alert" className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{t('personMentionsFailed')}</p>}
      {data && data.entries === 0 && (
        <p className={`text-sm ${muted}`}>{t('personId' in scope ? 'personMentionsEmpty' : 'groupMentionsEmpty', { name })}</p>
      )}
      {data && data.entries > 0 && (
        <>
          <div className="grid gap-1">
            <h3 className="text-xs font-medium">{t('personMentionsMonths')}</h3>
            <p className={`text-xs ${muted}`}>{pluralPhrase(t, 'personMentionsLastYear', lastYear, language)}</p>
            <ol className="flex h-28 items-end gap-1" aria-label={t('personMentionsMonths')}>
              {data.months.map((month) => {
                const mood = moodText(month, language, t);
                const description = mood
                  ? pluralPhrase(t, 'personMentionsMonthMood', month.entries, language, { month: monthLabel(month.period, 'long'), mood })
                  : pluralPhrase(t, 'personMentionsMonth', month.entries, language, { month: monthLabel(month.period, 'long') });
                return (
                  <li key={month.period} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={description}>
                    <span className="sr-only">{description}</span>
                    <span aria-hidden="true" className="h-4 text-xs leading-4">
                      {month.averageMood === null ? '' : moodEmoji(nearestMoodLevel(month.averageMood))}
                    </span>
                    <span
                      aria-hidden="true"
                      data-mention-bar
                      className={`w-full max-w-6 rounded-t ${month.entries ? 'bg-blue-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
                      style={{ height: month.entries ? `${Math.max(6, (month.entries / busiest) * 64)}px` : '2px' }}
                    />
                    <span aria-hidden="true" className={`w-full truncate text-center text-[0.65rem] ${muted}`}>{monthLabel(month.period, 'short')}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="grid gap-1">
            <h3 id={`${titleId}-years`} className="text-xs font-medium">{t('personMentionsYears')}</h3>
            <table aria-labelledby={`${titleId}-years`} className="w-full max-w-md text-left text-sm">
              <thead className={muted}>
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">{t('personMentionsYear')}</th>
                  <th scope="col" className="py-1 pr-3 font-medium">{t('personMentionsEntries')}</th>
                  <th scope="col" className="py-1 font-medium">{t('personMentionsAverageMood')}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.years].reverse().map((year) => (
                  <tr key={year.period} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th scope="row" className="py-1 pr-3 font-medium">{year.period}</th>
                    <td className="py-1 pr-3">{year.entries.toLocaleString(language)}</td>
                    <td className="py-1">{moodText(year, language, t) ?? <span className={muted}>{t('personMentionsNoMood')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`text-xs ${muted}`}>{t('personMentionsMoodHelp')}</p>
          </div>
        </>
      )}
    </section>
  );
}
