import { buildBook } from './book-converter.util';
import { compareErasChronologically, eraContains, mostSpecificEra, OUTSIDE_ERAS_CHAPTER_TITLE } from './book-era.util';

const university = { name: 'University', startDate: '2010-09-01', endDate: '2014-06-30' };
const erasmus = { name: 'Erasmus', startDate: '2012-09-01', endDate: '2013-06-30' };
const paris = { name: 'The Paris years', startDate: '2015-01-01', endDate: null };

describe('book-era.util', () => {
  it('covers an era from its first to its last day, with no end while it is ongoing', () => {
    expect(eraContains(university, '2010-09-01')).toBe(true);
    expect(eraContains(university, '2014-06-30')).toBe(true);
    expect(eraContains(university, '2014-07-01')).toBe(false);
    expect(eraContains(university, '2010-08-31')).toBe(false);
    expect(eraContains(paris, '2030-01-01')).toBe(true);
  });

  it('puts an entry in the shortest era that covers it, ongoing eras lasting until today', () => {
    const eras = [university, erasmus, paris];
    expect(mostSpecificEra(eras, '2013-01-10', '2026-10-27')).toBe(erasmus);
    expect(mostSpecificEra(eras, '2011-01-10', '2026-10-27')).toBe(university);
    expect(mostSpecificEra(eras, '2014-12-31', '2026-10-27')).toBeUndefined();

    // A long ongoing era loses to a closed one inside it, a short ongoing one wins
    const recent = { name: 'Remote work', startDate: '2026-01-01', endDate: null };
    const job = { name: 'First job', startDate: '2015-02-01', endDate: '2022-12-31' };
    expect(mostSpecificEra([paris, job], '2020-05-05', '2026-10-27')).toBe(job);
    expect(mostSpecificEra([paris, job, recent], '2026-05-05', '2026-10-27')).toBe(recent);
    // An entry dated after today still counts from its own date
    expect(mostSpecificEra([paris], '2027-01-01', '2026-10-27')).toBe(paris);
  });

  it('breaks ties by the later start, then by name', () => {
    const autumn = { name: 'Autumn', startDate: '2020-09-01', endDate: '2020-11-30' };
    const late = { name: 'Late', startDate: '2020-10-01', endDate: '2020-12-30' };
    const alsoAutumn = { name: 'Again', startDate: '2020-09-01', endDate: '2020-11-30' };
    expect(mostSpecificEra([autumn, late], '2020-10-15', '2026-10-27')).toBe(late);
    expect(mostSpecificEra([autumn, alsoAutumn], '2020-10-15', '2026-10-27')).toBe(alsoAutumn);
  });

  it('orders eras by start, the shorter and closed first, then by name', () => {
    const sameStartOngoing = { name: 'A', startDate: '2010-09-01', endDate: null };
    expect([paris, sameStartOngoing, erasmus, university].sort(compareErasChronologically))
      .toEqual([university, sameStartOngoing, erasmus, paris]);
    expect(compareErasChronologically({ ...paris, name: 'B' }, { ...paris, name: 'A' })).toBeGreaterThan(0);
  });

  describe('era books', () => {
    const entries = [
      { date: '2016-03-01', index: 1, tags: [], content: 'Montmartre', format: 'plain' as const },
      { date: '2011-02-01', index: 1, tags: ['uni'], content: 'First exams', format: 'plain' as const },
      { date: '2013-02-01', index: 1, tags: [], content: 'Lisbon semester', format: 'plain' as const },
      { date: '2008-05-01', index: 1, tags: [], content: 'High school', format: 'plain' as const },
      { date: '2011-01-01', index: 1, tags: [], content: '   ', format: 'plain' as const },
    ];

    it('makes one chapter per era in era order, then one for the entries outside every era', () => {
      const book = buildBook(entries, { title: 'Life', chapterMode: 'eras', eras: [paris, erasmus, university] });

      expect(book.chapters.map((chapter) => [chapter.title, chapter.entries.map((entry) => entry.content)])).toEqual([
        ['University', ['First exams']],
        ['Erasmus', ['Lisbon semester']],
        ['The Paris years', ['Montmartre']],
        [OUTSIDE_ERAS_CHAPTER_TITLE, ['High school']],
      ]);
    });

    it('leaves out eras without entries, and the outside chapter when asked', () => {
      const book = buildBook(entries.slice(0, 1).concat(entries[3]!), {
        title: 'Life',
        chapterMode: 'eras',
        eras: [university, paris],
        includeUntagged: false,
      });

      expect(book.chapters.map((chapter) => chapter.title)).toEqual(['The Paris years']);
    });

    it('puts every entry in the outside chapter when the writer has no eras', () => {
      const book = buildBook(entries, { title: 'Life', chapterMode: 'eras' });

      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0]?.title).toBe(OUTSIDE_ERAS_CHAPTER_TITLE);
      expect(book.chapters[0]?.entries.map((entry) => entry.date)).toEqual(['2008-05-01', '2011-02-01', '2013-02-01', '2016-03-01']);
    });
  });
});
