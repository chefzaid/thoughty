import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GetComfortReadsQueryDto } from './entries.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(GetComfortReadsQueryDto, query, 'query');

describe('GetComfortReadsQueryDto', () => {
  it('takes the entry just written, or nothing', async () => {
    await expect(invalidProperties({})).resolves.toEqual([]);
    await expect(parseLikeApi(GetComfortReadsQueryDto, { excludeId: '41' }, 'query')).resolves.toMatchObject({ excludeId: 41 });
  });

  it('rejects an invalid entry to leave out', async () => {
    for (const excludeId of ['0', '-1', 'abc', '1.5']) {
      await expect(invalidProperties({ excludeId })).resolves.toEqual(['excludeId']);
    }
  });
});
