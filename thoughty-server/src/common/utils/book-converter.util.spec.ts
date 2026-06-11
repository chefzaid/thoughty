import {
  buildBook,
  buildJournalDocument,
  stripMarkdown,
  renderBookMarkdown,
  renderBookHtml,
  UNTAGGED_CHAPTER_TITLE,
} from './book-converter.util';

describe('book-converter.util', () => {
  const entries = [
    { date: '2024-01-15', index: 1, tags: ['Travel'], content: 'Trip to Rome', format: 'plain' as const },
    { date: '2024-01-10', index: 1, tags: ['travel', 'food'], content: 'Pasta in Naples', format: 'plain' as const },
    { date: '2024-02-01', index: 1, tags: ['food'], content: 'Cooking at home', format: 'plain' as const },
    { date: '2024-03-05', index: 1, tags: [], content: 'Random thought', format: 'plain' as const },
  ];

  describe('buildBook', () => {
    it('should create one chapter per tag with entries sorted chronologically', () => {
      const book = buildBook(entries, { title: 'My Book' });

      const travel = book.chapters.find((c) => c.title.toLowerCase() === 'travel');
      expect(travel).toBeDefined();
      expect(travel!.entries.map((e) => e.content)).toEqual(['Pasta in Naples', 'Trip to Rome']);
    });

    it('should merge tags case-insensitively and keep the first-seen casing', () => {
      const book = buildBook(entries, { title: 'My Book' });

      const travelChapters = book.chapters.filter((c) => c.title.toLowerCase() === 'travel');
      expect(travelChapters).toHaveLength(1);
      expect(travelChapters[0].title).toBe('Travel');
      expect(travelChapters[0].entries).toHaveLength(2);
    });

    it('should place multi-tag entries in every matching chapter by default', () => {
      const book = buildBook(entries, { title: 'My Book' });

      const food = book.chapters.find((c) => c.title === 'food');
      expect(food!.entries.map((e) => e.content)).toEqual(['Pasta in Naples', 'Cooking at home']);
    });

    it('should place multi-tag entries only in their first tag chapter with tagScope first', () => {
      const book = buildBook(entries, { title: 'My Book', tagScope: 'first' });

      const food = book.chapters.find((c) => c.title === 'food');
      expect(food!.entries.map((e) => e.content)).toEqual(['Cooking at home']);
    });

    it('should add an untagged chapter at the end by default', () => {
      const book = buildBook(entries, { title: 'My Book' });

      const lastChapter = book.chapters.at(-1);
      expect(lastChapter!.title).toBe(UNTAGGED_CHAPTER_TITLE);
      expect(lastChapter!.entries.map((e) => e.content)).toEqual(['Random thought']);
    });

    it('should omit untagged entries when includeUntagged is false', () => {
      const book = buildBook(entries, { title: 'My Book', includeUntagged: false });

      expect(book.chapters.some((c) => c.title === UNTAGGED_CHAPTER_TITLE)).toBe(false);
    });

    it('should sort chapters alphabetically by default', () => {
      const book = buildBook(entries, { title: 'My Book', includeUntagged: false });

      expect(book.chapters.map((c) => c.title)).toEqual(['food', 'Travel']);
    });

    it('should sort chapters by entry count with chapterOrder entries', () => {
      const extra = [
        ...entries,
        { date: '2024-04-01', index: 1, tags: ['food'], content: 'Baking bread', format: 'plain' as const },
      ];
      const book = buildBook(extra, { title: 'My Book', chapterOrder: 'entries', includeUntagged: false });

      expect(book.chapters[0].title).toBe('food');
    });

    it('should sort chapters by first entry date with chapterOrder chrono', () => {
      const book = buildBook(entries, { title: 'My Book', chapterOrder: 'chrono', includeUntagged: false });

      // Both start 2024-01-10 (food via Pasta, travel via Pasta) -> alphabetical tiebreak
      expect(book.chapters.map((c) => c.title)).toEqual(['food', 'Travel']);
    });

    it('should only build chapters for the requested tags', () => {
      const book = buildBook(entries, { title: 'My Book', tags: ['food'] });

      expect(book.chapters.map((c) => c.title)).toEqual(['food']);
    });

    it('should skip entries with empty content', () => {
      const book = buildBook(
        [{ date: '2024-01-01', index: 1, tags: ['a'], content: '   ', format: 'plain' as const }],
        { title: 'My Book' },
      );

      expect(book.chapters).toHaveLength(0);
    });

    it('should normalize Date objects and ISO timestamps to YYYY-MM-DD', () => {
      const book = buildBook(
        [
          { date: new Date('2024-05-01T10:00:00Z'), index: 1, tags: ['a'], content: 'one' },
          { date: '2024-05-02T08:00:00.000Z', index: 1, tags: ['a'], content: 'two' },
        ],
        { title: 'My Book' },
      );

      expect(book.chapters[0].entries.map((e) => e.date)).toEqual(['2024-05-01', '2024-05-02']);
    });

    it('should carry title, author, and generation date', () => {
      const book = buildBook(entries, { title: 'My Book', author: 'Jane' });

      expect(book.title).toBe('My Book');
      expect(book.author).toBe('Jane');
      expect(book.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('buildJournalDocument', () => {
    it('should group entries chronologically into month chapters', () => {
      const document = buildJournalDocument(entries, { title: 'My Journal', author: 'Jane' });

      expect(document.title).toBe('My Journal');
      expect(document.author).toBe('Jane');
      expect(document.chapters.map((c) => c.title)).toEqual([
        'January 2024',
        'February 2024',
        'March 2024',
      ]);
      expect(document.chapters[0].entries.map((e) => e.content)).toEqual([
        'Pasta in Naples',
        'Trip to Rome',
      ]);
    });

    it('should keep untagged entries in their month chapter', () => {
      const document = buildJournalDocument(entries, { title: 'My Journal' });

      expect(document.chapters[2].entries[0].content).toBe('Random thought');
    });

    it('should skip empty entries', () => {
      const document = buildJournalDocument(
        [{ date: '2024-01-01', index: 1, tags: [], content: '  ' }],
        { title: 'My Journal' },
      );

      expect(document.chapters).toHaveLength(0);
    });
  });

  describe('narrative chapters', () => {
    const narrativeBook = {
      title: 'My Book',
      generatedAt: '2024-06-01',
      chapters: [
        {
          title: 'Travel',
          narrative: 'A woven story about travel.\n\nIt flows across paragraphs.',
          entries: [
            { date: '2024-01-10', index: 1, tags: ['travel'], content: 'Raw entry', format: 'plain' as const },
          ],
        },
      ],
    };

    it('should render the narrative instead of listing entries in Markdown', () => {
      const output = renderBookMarkdown(narrativeBook);

      expect(output).toContain('A woven story about travel.');
      expect(output).not.toContain('Raw entry');
      expect(output).not.toContain('### 2024-01-10');
    });

    it('should render the narrative instead of listing entries in HTML', () => {
      const output = renderBookHtml(narrativeBook);

      expect(output).toContain('A woven story about travel.');
      expect(output).not.toContain('Raw entry');
      expect(output).not.toContain('2024-01-10');
    });
  });

  describe('stripMarkdown', () => {
    it('should remove headings, emphasis, and inline code', () => {
      expect(stripMarkdown('# Title\n**bold** and *italic* and `code`')).toBe(
        'Title\nbold and italic and code',
      );
    });

    it('should keep link and image text but drop the URL', () => {
      expect(stripMarkdown('See [docs](https://example.com) and ![alt](img.png)')).toBe(
        'See docs and alt',
      );
    });

    it('should normalize list markers and remove code fences and quotes', () => {
      expect(stripMarkdown('```js\ncode\n```\n* item\n> quote')).toBe('code\n- item\nquote');
    });
  });

  describe('renderBookMarkdown', () => {
    it('should render title page, table of contents, and chapters', () => {
      const book = buildBook(entries, { title: 'My Book', author: 'Jane' });
      const output = renderBookMarkdown(book);

      expect(output).toContain('# My Book');
      expect(output).toContain('*by Jane*');
      expect(output).toContain('## Table of Contents');
      expect(output).toContain('## Chapter 1: food');
      expect(output).toContain('### 2024-01-10');
      expect(output).toContain('Pasta in Naples');
    });

    it('should omit dates and table of contents when disabled', () => {
      const book = buildBook(entries, { title: 'My Book' });
      const output = renderBookMarkdown(book, { includeDates: false, includeToc: false });

      expect(output).not.toContain('## Table of Contents');
      expect(output).not.toContain('### 2024-01-10');
    });
  });

  describe('renderBookHtml', () => {
    it('should render a standalone HTML document with chapters', () => {
      const book = buildBook(entries, { title: 'My Book', author: 'Jane' });
      const output = renderBookHtml(book);

      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('<h1>My Book</h1>');
      expect(output).toContain('by Jane');
      expect(output).toContain('Table of Contents');
      expect(output).toContain('Chapter 1: food');
      expect(output).toContain('Pasta in Naples');
    });

    it('should escape HTML in titles and content', () => {
      const book = buildBook(
        [{ date: '2024-01-01', index: 1, tags: ['<b>tag</b>'], content: '<script>alert(1)</script>' }],
        { title: '<My> & "Book"' },
      );
      const output = renderBookHtml(book);

      expect(output).not.toContain('<script>alert(1)</script>');
      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('&lt;My&gt; &amp; &quot;Book&quot;');
      expect(output).toContain('&lt;b&gt;tag&lt;/b&gt;');
    });

    it('should omit the table of contents when disabled', () => {
      const book = buildBook(entries, { title: 'My Book' });
      const output = renderBookHtml(book, { includeToc: false });

      expect(output).not.toContain('Table of Contents');
    });
  });
});
