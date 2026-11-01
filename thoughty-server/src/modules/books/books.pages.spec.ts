import { BadRequestException } from '@nestjs/common';
import { BooksService } from './books.service';
import type { BookEntrySourceService } from './book-entry-source.service';
import { expectApiError } from '@/common/errors/api-error.test-helpers';

/** The book's own pages (dedication, epigraph): checked, normalized and printed in every format. */
describe('BooksService book pages', () => {
  const entries = [
    { id: 1, date: '2024-01-10', index: 1, tags: ['travel'], content: 'Pasta in Naples', format: 'plain' },
    { id: 2, date: '2024-03-05', index: 1, tags: [], content: 'Random thought', format: 'plain' },
  ];
  let entrySource: { select: jest.Mock };
  let service: BooksService;
  let config: { getConfig: jest.Mock };

  beforeEach(() => {
    config = { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) };
    entrySource = { select: jest.fn().mockResolvedValue({ entries, source: { kind: 'journal' } }) };
    service = new BooksService(
      entrySource as unknown as BookEntrySourceService,
      { findOne: jest.fn().mockResolvedValue({ id: 1, username: 'jane' }) } as never,
      { isConfigured: jest.fn().mockResolvedValue(false) } as never,
      { getFileBuffer: jest.fn() } as never,
      { findAll: jest.fn().mockResolvedValue([]) } as never,
      config as never,
    );
  });

  it('keeps the dedication and epigraph, normalized, and leaves out blank ones', async () => {
    const book = await service.buildBookForUser(1, { dedication: '  For Marie,\r\nwho listened.  ', epigraph: ' \n ' });

    expect(book.dedication).toBe('For Marie,\nwho listened.');
    expect(book.epigraph).toBeUndefined();
  });

  it.each([
    ['dedication', 'BOOK_DEDICATION_TOO_LONG', 301],
    ['epigraph', 'BOOK_EPIGRAPH_TOO_LONG', 501],
  ] as const)('refuses a %s over its limit before selecting entries', async (field, code, length) => {
    await expectApiError(service.buildBookForUser(1, { [field]: 'a'.repeat(length) }), BadRequestException, code);
    expect(entrySource.select).not.toHaveBeenCalled();
  });

  it('takes texts at their limits once trimmed', async () => {
    const book = await service.buildBookForUser(1, { dedication: ` ${'a'.repeat(300)} `, epigraph: 'b'.repeat(500) });

    expect(book.dedication).toHaveLength(300);
    expect(book.epigraph).toHaveLength(500);
  });

  it.each(['md', 'html'] as const)('prints the dedication and epigraph in %s, escaped', async (format) => {
    const file = await service.export(1, {
      format,
      narrative: false,
      dedication: 'For <script>alert(1)</script>',
      epigraph: 'Moments & days\n— Pavese',
    });
    const content = file.content as string;

    expect(content).not.toContain('<script>');
    expect(content.indexOf('Pavese')).toBeGreaterThan(content.indexOf('alert'));
    expect(content.indexOf('Pavese')).toBeLessThan(content.indexOf('Pasta in Naples'));
  });

  it('ends the book with the closing page only when asked, made on the writer’s day', async () => {
    expect((await service.buildBookForUser(1, {})).closingPage).toBe(false);
    const file = await service.export(1, { format: 'md', narrative: false, closingPage: true, today: '2026-11-01' });

    expect(file.content).toContain('## About this book\n\nEntries from January 10, 2024 to March 5, 2024\n\n2 entries\n\nMade with Thoughty on November 1, 2026');
  });

  it('prints them on their own pages of the PDF', async () => {
    const file = await service.export(1, { narrative: false, dedication: 'For Marie', epigraph: 'A quotation' });
    const raw = (file.content as Buffer).toString('latin1');

    expect(raw).toContain('(dedication)');
    expect(raw).toContain('(epigraph)');
  });

  it('writes a French writer’s book in French, read from their settings', async () => {
    config.getConfig.mockResolvedValue({ language: 'fr' });
    const book = await service.buildBookForUser(1, { chapterMode: 'month' });
    const file = await service.export(1, { format: 'md', narrative: false, closingPage: true, today: '2026-11-01', chapterMode: 'month' });

    expect(config.getConfig).toHaveBeenCalledWith(1);
    expect(book.language).toBe('fr');
    expect(book.title).toBe('Mon livre de pensées');
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['Janvier 2024', 'Mars 2024']);
    expect(file.content).toContain('*par jane*\n\n*1 novembre 2026*');
    expect(file.content).toContain('## Table des matières');
    expect(file.content).toContain('## Chapitre 1 : Janvier 2024');
    expect(file.content).toContain('### 10 janvier 2024');
    expect(file.content).toContain('## À propos de ce livre\n\nEntrées du 10 janvier 2024 au 5 mars 2024\n\n2 entrées\n\nFait avec Thoughty le 1 novembre 2026');
  });

  it('writes the book in English for any other language setting', async () => {
    config.getConfig.mockResolvedValue({ language: 'de' });

    expect((await service.buildBookForUser(1, {})).language).toBe('en');
  });
});
