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

  beforeEach(() => {
    entrySource = { select: jest.fn().mockResolvedValue({ entries, source: { kind: 'journal' } }) };
    service = new BooksService(
      entrySource as unknown as BookEntrySourceService,
      { findOne: jest.fn().mockResolvedValue({ id: 1, username: 'jane' }) } as never,
      { isConfigured: jest.fn().mockResolvedValue(false) } as never,
      { getFileBuffer: jest.fn() } as never,
      { findAll: jest.fn().mockResolvedValue([]) } as never,
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

  it('prints them on their own pages of the PDF', async () => {
    const file = await service.export(1, { narrative: false, dedication: 'For Marie', epigraph: 'A quotation' });
    const raw = (file.content as Buffer).toString('latin1');

    expect(raw).toContain('(dedication)');
    expect(raw).toContain('(epigraph)');
  });
});
