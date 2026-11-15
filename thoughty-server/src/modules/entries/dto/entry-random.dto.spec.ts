import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GetRandomEntryQueryDto } from './entries.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(GetRandomEntryQueryDto, query, 'query');

describe('GetRandomEntryQueryDto', () => {
  it('takes the journal list query, as the web sends it, and the entry picked last', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
    await expect(
      invalidProperties({
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

    await expect(parseLikeApi(GetRandomEntryQueryDto, { excludeId: '41' }, 'query')).resolves.toMatchObject({ excludeId: 41 });
  });

  it('takes no batch, and rejects an invalid entry to skip or filter', async () => {
    await expect(parseLikeApi(GetRandomEntryQueryDto, {}, 'query')).resolves.not.toHaveProperty('limit');
    for (const batch of ['limit', 'after', 'from', 'before', 'around', 'page']) {
      await expect(invalidProperties({ [batch]: '1' })).resolves.toEqual([batch]);
    }
    for (const excludeId of ['0', '-1', 'abc', '1.5']) {
      await expect(invalidProperties({ excludeId })).resolves.toEqual(['excludeId']);
    }
    await expect(invalidProperties({ mood: '6' })).resolves.toEqual(['mood']);
    await expect(invalidProperties({ sort: 'random' })).resolves.toEqual(['sort']);
  });
});
