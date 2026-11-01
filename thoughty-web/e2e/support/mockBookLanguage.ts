/** The mock book's language: the writer's app language, as `resolveBookLanguage` reads it on the server. */
export type MockBookLanguage = "en" | "fr";

/** The words the server's book writes itself, as `book-language.util.ts` has them, for the mock's book. */
export const MOCK_BOOK_COPY = {
  en: {
    byAuthor: (author: string) => `by ${author}`,
    tableOfContents: "Table of Contents",
    chapterNumber: (number: number) => `Chapter ${number}`,
    chapterHeading: (number: number, title: string) => `Chapter ${number}: ${title}`,
    untaggedChapter: "Untagged Thoughts",
    outsideErasChapter: "Other",
    defaultBookTitle: "My Book of Thoughts",
    closingHeading: "About this book",
    entriesOn: (date: string) => `Entries from ${date}`,
    entriesBetween: (first: string, last: string) => `Entries from ${first} to ${last}`,
    entryCount: (count: number) => (count === 1 ? "1 entry" : `${count} entries`),
    madeOn: (date: string) => `Made with Thoughty on ${date}`,
  },
  fr: {
    byAuthor: (author: string) => `par ${author}`,
    tableOfContents: "Table des matières",
    chapterNumber: (number: number) => `Chapitre ${number}`,
    chapterHeading: (number: number, title: string) => `Chapitre ${number} : ${title}`,
    untaggedChapter: "Pensées sans tag",
    outsideErasChapter: "Autres",
    defaultBookTitle: "Mon livre de pensées",
    closingHeading: "À propos de ce livre",
    entriesOn: (date: string) => `Entrées du ${date}`,
    entriesBetween: (first: string, last: string) => `Entrées du ${first} au ${last}`,
    entryCount: (count: number) => (count <= 1 ? `${count} entrée` : `${count} entrées`),
    madeOn: (date: string) => `Fait avec Thoughty le ${date}`,
  },
} as const;

/** A day (`YYYY-MM-DD`) as the server's book writes it: "May 1, 2024", "1 mai 2024". */
export function mockBookDate(day: string, language: MockBookLanguage): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** A month chapter's title as the server's book writes it: "May 2024", "Mai 2024". */
export function mockBookMonth(month: string, language: MockBookLanguage): string {
  const name = new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}
