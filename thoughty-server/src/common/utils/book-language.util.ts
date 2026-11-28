import { normalizeEntryLocation, type EntryLocation } from './entry-location.util';

/**
 * The words a book writes itself (around the writer's own entries), in the writer's app language:
 * books, and the journal documents built like them, in every format.
 */
export type BookLanguage = 'en' | 'fr';

/** The book language for a writer's `language` setting: French for `fr`, English for anything else. */
export function resolveBookLanguage(language: string | undefined): BookLanguage {
  return language === 'fr' ? 'fr' : 'en';
}

export interface BookCopy {
  byAuthor: (author: string) => string;
  coverAlt: (title: string) => string;
  titlePage: string;
  dedication: string;
  epigraph: string;
  tableOfContents: string;
  /** A chapter's number above its title, as the PDF prints it. */
  chapterNumber: (number: number) => string;
  /** A chapter's heading with its number, as the other formats and the PDF outline print it. */
  chapterHeading: (number: number, title: string) => string;
  introduction: string;
  chapterSummary: string;
  untaggedChapter: string;
  outsideErasChapter: string;
  defaultBookTitle: string;
  defaultJournalTitle: string;
  closingHeading: string;
  entriesOn: (date: string) => string;
  entriesBetween: (first: string, last: string) => string;
  /** The entry count, by the language's plural category of the count. */
  entryCount: (count: string, plural: Intl.LDMLPluralRule) => string;
  madeOn: (date: string) => string;
  /** The letters after a coordinate's degrees: north, south, east and west. */
  compass: { north: string; south: string; east: string; west: string };
}

const BOOK_COPY: Record<BookLanguage, BookCopy> = {
  en: {
    byAuthor: (author) => `by ${author}`,
    coverAlt: (title) => `${title} cover`,
    titlePage: 'Title Page',
    dedication: 'Dedication',
    epigraph: 'Epigraph',
    tableOfContents: 'Table of Contents',
    chapterNumber: (number) => `Chapter ${number}`,
    chapterHeading: (number, title) => `Chapter ${number}: ${title}`,
    introduction: 'Introduction',
    chapterSummary: 'Chapter Summary',
    untaggedChapter: 'Untagged Thoughts',
    outsideErasChapter: 'Other',
    defaultBookTitle: 'My Book of Thoughts',
    defaultJournalTitle: 'My Journal',
    closingHeading: 'About this book',
    entriesOn: (date) => `Entries from ${date}`,
    entriesBetween: (first, last) => `Entries from ${first} to ${last}`,
    entryCount: (count, plural) => (plural === 'one' ? `${count} entry` : `${count} entries`),
    madeOn: (date) => `Made with Thoughty on ${date}`,
    compass: { north: 'N', south: 'S', east: 'E', west: 'W' },
  },
  fr: {
    byAuthor: (author) => `par ${author}`,
    coverAlt: (title) => `Couverture de ${title}`,
    titlePage: 'Page de titre',
    dedication: 'Dédicace',
    epigraph: 'Épigraphe',
    tableOfContents: 'Table des matières',
    chapterNumber: (number) => `Chapitre ${number}`,
    chapterHeading: (number, title) => `Chapitre ${number} : ${title}`,
    introduction: 'Introduction',
    chapterSummary: 'Résumé du chapitre',
    untaggedChapter: 'Pensées sans tag',
    outsideErasChapter: 'Autres',
    defaultBookTitle: 'Mon livre de pensées',
    defaultJournalTitle: 'Mon journal',
    closingHeading: 'À propos de ce livre',
    entriesOn: (date) => `Entrées du ${date}`,
    entriesBetween: (first, last) => `Entrées du ${first} au ${last}`,
    entryCount: (count, plural) => (plural === 'one' ? `${count} entrée` : `${count} entrées`),
    madeOn: (date) => `Fait avec Thoughty le ${date}`,
    compass: { north: 'N', south: 'S', east: 'E', west: 'O' },
  },
};

/** The book's own words in `language`, English when it has none. */
export function bookCopy(language: BookLanguage = 'en'): BookCopy {
  return BOOK_COPY[language];
}

/**
 * `Intl` separates French thousands and English times with a narrow no-break space, which the PDF's
 * standard fonts cannot draw; a no-break space looks the same and every format can.
 */
function printable(text: string): string {
  return text.replaceAll(' ', ' ');
}

/** A day (`YYYY-MM-DD`), and its time of day (`HH:MM`) when it has one, as the book's language writes it. */
export function formatBookDate(day: string, language: BookLanguage = 'en', timeOfDay?: string | null): string {
  const date = new Date(`${day}T${timeOfDay ?? '00:00'}:00Z`);
  if (Number.isNaN(date.getTime())) {
    return timeOfDay ? `${day} ${timeOfDay}` : day;
  }
  return printable(new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    ...(timeOfDay ? { timeStyle: 'short' } : {}),
    timeZone: 'UTC',
  }).format(date));
}

/** A month (`YYYY-MM`) as a chapter heading in the book's language: "May 2024", "Mai 2024". */
export function formatBookMonth(month: string, language: BookLanguage = 'en'): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return month;
  }
  const name = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}

/** How many entries, in the book's language, its number format and its plural rules (French counts 0 as one). */
export function formatBookEntryCount(count: number, language: BookLanguage = 'en'): string {
  const plural = new Intl.PluralRules(language).select(count);
  return bookCopy(language).entryCount(printable(new Intl.NumberFormat(language).format(count)), plural);
}

function formatCoordinate(value: number, positive: string, negative: string, language: BookLanguage): string {
  const degrees = new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(Math.abs(value));
  return `${degrees}° ${value < 0 ? negative : positive}`;
}

/**
 * An entry's place as a book prints it, the way the journal shows it: the name the writer gave it, else its
 * coordinates in the book's language (`45.8992° N, 6.1294° E`, `45,8992° N, 6,1294° E`). Undefined without a place.
 */
export function formatBookPlace(location: Partial<EntryLocation> | null | undefined, language: BookLanguage = 'en'): string | undefined {
  const place = normalizeEntryLocation(location);
  if (!place) {
    return undefined;
  }
  if (place.name) {
    return place.name;
  }
  const { compass } = bookCopy(language);
  return [
    formatCoordinate(place.latitude as number, compass.north, compass.south, language),
    formatCoordinate(place.longitude as number, compass.east, compass.west, language),
  ].join(', ');
}
