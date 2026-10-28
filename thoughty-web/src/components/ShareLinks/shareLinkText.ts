import type { ShareLink } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

export function formatShareDate(value: string, language: Language, withTime = false): string {
  return new Intl.DateTimeFormat(language, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
    .format(new Date(value));
}

/** How the writer tells a link apart: their note, or when it was made. */
export function shareLinkName(link: Pick<ShareLink, 'label' | 'createdAt'>, t: TranslationFunction, language: Language): string {
  return link.label ?? t('shareLinkUntitled', { date: formatShareDate(link.createdAt, language, true) });
}

/** How often the link was read, against its limit when it has one. */
export function shareLinkViews(link: Pick<ShareLink, 'viewCount' | 'maxViews'>, t: TranslationFunction, language: Language): string {
  if (link.maxViews === null) {
    return pluralPhrase(t, 'shareLinkViews', link.viewCount, language);
  }
  return link.viewCount >= link.maxViews
    ? t('shareLinkUsedUp')
    : t('shareLinkViewsLimited', { views: link.viewCount.toLocaleString(language), max: link.maxViews.toLocaleString(language) });
}

/** An entry's day (`YYYY-MM-DD`, or a timestamp starting with it) as a reader of the language writes it. */
export function formatEntryDay(date: string, language: Language): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(year, month - 1, day));
}
