import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GetEntryReaderQueryDto } from './entries.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(GetEntryReaderQueryDto, query, 'query');

describe('GetEntryReaderQueryDto', () => {
  it('takes the journal filters, a day or a month, and the entry to show', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
    await expect(
      invalidProperties({
        search: 'harbor',
        tags: 'family,travel',
        date: '2026-10-21',
        month: '2026-10',
        visibility: 'private',
        favorites: 'true',
        archiveStatus: 'active',
        mood: '4,5',
        diaryId: '2',
        ids: '3,1,2',
        eraId: '3',
        personId: '8',
        entryId: '41',
      }),
    ).resolves.toEqual([]);

    await expect(parseLikeApi(GetEntryReaderQueryDto, { entryId: '41', favorites: '1' }, 'query'))
      .resolves.toMatchObject({ entryId: 41, favorites: true });
  });

  it('takes no page, size or order, and rejects an invalid day, month or entry', async () => {
    const parsed = await parseLikeApi(GetEntryReaderQueryDto, {}, 'query');
    expect(parsed).not.toHaveProperty('page');
    expect(parsed).not.toHaveProperty('limit');
    for (const entryId of ['0', '-1', 'abc', '1.5']) {
      await expect(invalidProperties({ entryId })).resolves.toEqual(['entryId']);
    }
    for (const month of ['2026-13', '2026-1', 'october']) {
      await expect(invalidProperties({ month })).resolves.toEqual(['month']);
    }
    await expect(invalidProperties({ date: '21/10/2026' })).resolves.toEqual(['date']);
    await expect(invalidProperties({ mood: '6' })).resolves.toEqual(['mood']);
  });
});
