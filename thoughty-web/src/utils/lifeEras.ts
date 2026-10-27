import type { LifeEra } from '../services/api/lifeErasService';
import type { TranslationFunction } from '../types';
import type { Language } from './translations';

type EraRange = Pick<LifeEra, 'startDate' | 'endDate'>;

/** The profile section where life eras are managed, as the address names it (`/profile#life-eras`). */
export const LIFE_ERAS_SECTION_ID = 'life-eras';

/** An era's name, after its emoji when it has one. */
export function eraLabel(era: Pick<LifeEra, 'name' | 'emoji'>): string {
  return era.emoji ? `${era.emoji} ${era.name}` : era.name;
}

/** Whether an era covers the day `date` (`YYYY-MM-DD`), first and last days included; an ongoing era has no end. */
export function eraContains(era: EraRange, date: string): boolean {
  return date >= era.startDate && (era.endDate === null || date <= era.endDate);
}

/** The eras that cover a day, in the order given. */
export function erasOnDate<T extends EraRange>(eras: readonly T[], date: string): T[] {
  return eras.filter((era) => eraContains(era, date));
}

/** A `YYYY-MM-DD` day written for the reader ("1 Sept 2010"), whatever their time zone. */
export function formatEraDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

/** The era's dates for the reader: "1 Sept 2010 – 30 Jun 2014", or "Since 1 Jan 2015" while it is ongoing. */
export function formatEraRange(era: EraRange, language: Language, t: TranslationFunction): string {
  const start = formatEraDate(era.startDate, language);
  return era.endDate === null
    ? t('lifeEraSince', { start })
    : t('lifeEraRange', { start, end: formatEraDate(era.endDate, language) });
}

/** A list of names joined for the reader ("University and Erasmus"). */
export function joinEraNames(eras: readonly Pick<LifeEra, 'name' | 'emoji'>[], language: Language): string {
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(eras.map(eraLabel));
}
