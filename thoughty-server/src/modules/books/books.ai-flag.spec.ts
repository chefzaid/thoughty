import { BooksService } from './books.service';
import type { BookEntrySourceService } from './book-entry-source.service';
import { featureFlagsWith } from '@/common/feature-flags/feature-flags.test-helpers';

/** The book's AI options follow the `ai` feature flag; a plain book does not need it. */
describe('BooksService with AI switched off', () => {
  const entries = [{ id: 1, date: '2024-01-10', index: 1, tags: [], content: 'Pasta in Naples', format: 'plain' }];
  let composer: { isConfigured: jest.Mock; composeBookChapter: jest.Mock; composeChapterFraming: jest.Mock };
  let service: BooksService;

  beforeEach(() => {
    composer = { isConfigured: jest.fn().mockResolvedValue(true), composeBookChapter: jest.fn(), composeChapterFraming: jest.fn() };
    service = new BooksService(
      { select: jest.fn().mockResolvedValue({ entries, source: { kind: 'journal' } }) } as unknown as BookEntrySourceService,
      { findOne: jest.fn().mockResolvedValue({ id: 1, username: 'jane' }) } as never,
      composer as never,
      { getFileBuffer: jest.fn() } as never,
      { findAll: jest.fn().mockResolvedValue([]) } as never,
      { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) } as never,
      featureFlagsWith({ ai: false }),
    );
  });

  it('refuses the AI narrative and the AI chapter framing with FEATURE_DISABLED', async () => {
    await expect(service.export(1, {})).rejects.toMatchObject({ response: { code: 'FEATURE_DISABLED' } });
    await expect(service.export(1, { narrative: false, chapterFraming: true })).rejects.toMatchObject({
      response: { code: 'FEATURE_DISABLED' },
    });
    expect(composer.composeBookChapter).not.toHaveBeenCalled();
    expect(composer.composeChapterFraming).not.toHaveBeenCalled();
  });

  it('still makes a plain book', async () => {
    const file = await service.export(1, { narrative: false, format: 'md' });

    expect(String(file.content)).toContain('Pasta in Naples');
  });
});
