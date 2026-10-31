import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GetRandomEntryQueryDto } from './entries.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(GetRandomEntryQueryDto, query, 'query');

describe('GetRandomEntryQueryDto', () => {
  it('takes the journal list query, as the web sends it, and the entry picked last', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
    await expect(
      invalidProperties({
        limit: '10',
        search: '',
        tags: 'family,travel',
        date: '',
        visibility: '',
        sort: 'date',
        favorites: 'true',
        archiveStatus: 'active',
        mood: '4,5',
        diaryId: '2',
        ids: '3,1,2',
        eraId: '3',
        personId: '8',
        excludeId: '41',
      }),
    ).resolves.toEqual([]);

    await expect(parseLikeApi(GetRandomEntryQueryDto, { limit: '25', excludeId: '41' }, 'query'))
      .resolves.toMatchObject({ limit: 25, excludeId: 41 });
    await expect(parseLikeApi(GetRandomEntryQueryDto, {}, 'query')).resolves.toMatchObject({ limit: 10 });
  });

  it('takes no page, and rejects an invalid entry to skip or filter', async () => {
    await expect(parseLikeApi(GetRandomEntryQueryDto, {}, 'query')).resolves.not.toHaveProperty('page');
    for (const excludeId of ['0', '-1', 'abc', '1.5']) {
      await expect(invalidProperties({ excludeId })).resolves.toEqual(['excludeId']);
    }
    await expect(invalidProperties({ mood: '6' })).resolves.toEqual(['mood']);
    await expect(invalidProperties({ sort: 'random' })).resolves.toEqual(['sort']);
    await expect(invalidProperties({ limit: '0' })).resolves.toEqual(['limit']);
  });
});
