import { bookCopy, formatBookDate, formatBookEntryCount, formatBookMonth, resolveBookLanguage } from './book-language.util';
import { buildBook, buildJournalDocument } from './book-converter.util';
import { bookClosingPageLines } from './book-pages.util';

describe('book language', () => {
  it('follows the writer’s language setting, English for anything but French', () => {
    expect(resolveBookLanguage('fr')).toBe('fr');
    expect(resolveBookLanguage('en')).toBe('en');
    expect(resolveBookLanguage('de')).toBe('en');
    expect(resolveBookLanguage(undefined)).toBe('en');
    expect(bookCopy()).toBe(bookCopy('en'));
  });

  it('writes the book’s own words in each language', () => {
    expect(bookCopy('en').byAuthor('Jane')).toBe('by Jane');
    expect(bookCopy('fr').byAuthor('Jeanne')).toBe('par Jeanne');
    expect(bookCopy('fr').chapterHeading(2, 'Voyages')).toBe('Chapitre 2 : Voyages');
    expect(bookCopy('fr').coverAlt('Mon livre')).toBe('Couverture de Mon livre');
    expect(bookCopy('fr').entriesBetween('1 mai 2024', '2 juin 2024')).toBe('Entrées du 1 mai 2024 au 2 juin 2024');
  });

  it('writes days with their month names and times in the book’s language', () => {
    expect(formatBookDate('2024-05-01')).toBe('May 1, 2024');
    expect(formatBookDate('2024-05-01', 'fr')).toBe('1 mai 2024');
    expect(formatBookDate('2024-05-01', 'en', '21:30')).toBe('May 1, 2024 at 9:30 PM');
    expect(formatBookDate('2024-05-01', 'fr', '21:30')).toBe('1 mai 2024 à 21:30');
    // Every space is one the PDF's standard fonts can draw
    expect(formatBookDate('2024-05-01', 'en', '07:05')).not.toMatch(/ /);
  });

  it('keeps a day it cannot read as it is', () => {
    expect(formatBookDate('someday', 'fr')).toBe('someday');
    expect(formatBookDate('someday', 'fr', '07:05')).toBe('someday 07:05');
    expect(formatBookMonth('2024-13', 'fr')).toBe('2024-13');
  });

  it('heads month chapters with a capitalized month name', () => {
    expect(formatBookMonth('2024-05')).toBe('May 2024');
    expect(formatBookMonth('2024-05', 'fr')).toBe('Mai 2024');
    expect(formatBookMonth('2024-08', 'fr')).toBe('Août 2024');
  });

  it('counts entries with each language’s plurals and number format', () => {
    expect(formatBookEntryCount(0)).toBe('0 entries');
    expect(formatBookEntryCount(1)).toBe('1 entry');
    expect(formatBookEntryCount(1234)).toBe('1,234 entries');
    // French counts zero as singular
    expect(formatBookEntryCount(0, 'fr')).toBe('0 entrée');
    expect(formatBookEntryCount(1, 'fr')).toBe('1 entrée');
    expect(formatBookEntryCount(2, 'fr')).toBe('2 entrées');
    expect(formatBookEntryCount(1234, 'fr')).toBe('1 234 entrées');
  });

  it('dates a closing page of one day in French', () => {
    const entry = { id: 1, date: '2024-05-01', index: 1, tags: [], content: 'Un jour', format: 'plain' as const };

    expect(bookClosingPageLines({ chapters: [{ title: 'Mai 2024', entries: [entry] }], generatedAt: '2026-08-01', language: 'fr' }))
      .toEqual(['Entrées du 1 mai 2024', '1 entrée', 'Fait avec Thoughty le 1 août 2026']);
  });

  describe('chapters the book names itself', () => {
    const entries = [
      { date: '2024-05-01', index: 1, tags: [], content: 'Untagged', format: 'plain' as const },
      { date: '2024-08-02', index: 1, tags: ['voyage'], content: 'Tagged', format: 'plain' as const },
    ];

    it('names month chapters, the untagged chapter and the one outside every era in French', () => {
      expect(buildBook(entries, { title: 'Livre', chapterMode: 'month', language: 'fr' }).chapters.map((chapter) => chapter.title))
        .toEqual(['Mai 2024', 'Août 2024']);
      expect(buildBook(entries, { title: 'Livre', language: 'fr' }).chapters.map((chapter) => chapter.title))
        .toEqual(['voyage', 'Pensées sans tag']);
      const eras = [{ name: 'Été', startDate: '2024-06-01', endDate: '2024-08-31' }];
      expect(buildBook(entries, { title: 'Livre', chapterMode: 'eras', eras, language: 'fr' }).chapters.map((chapter) => chapter.title))
        .toEqual(['Été', 'Autres']);
      expect(buildBook(entries, { title: 'Book', chapterMode: 'eras', eras }).chapters.map((chapter) => chapter.title))
        .toEqual(['Été', 'Other']);
    });

    it('keeps the language with the book and the journal document', () => {
      expect(buildBook(entries, { title: 'Livre', language: 'fr' }).language).toBe('fr');
      expect(buildBook(entries, { title: 'Livre', chapterMode: 'year', language: 'fr' }).language).toBe('fr');
      const document = buildJournalDocument(entries, { title: 'Journal', language: 'fr' });
      expect(document.language).toBe('fr');
      expect(document.chapters.map((chapter) => chapter.title)).toEqual(['Mai 2024', 'Août 2024']);
      expect(buildJournalDocument(entries, { title: 'Journal' }).chapters[0].title).toBe('May 2024');
    });
  });
});
