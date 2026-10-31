import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { RecycleBinQueryDto, RecycleBinRestoreDto, RecycleBinSelectionDto } from './recycle-bin.dto';

const invalidSelection = (ids: unknown) => invalidPropertiesLikeApi(RecycleBinSelectionDto, { ids });

describe('recycle bin DTOs', () => {
  it('reads paging from the query string with defaults and a page size cap', async () => {
    await expect(parseLikeApi(RecycleBinQueryDto, {}, 'query')).resolves.toMatchObject({ page: 1, limit: 20 });
    await expect(parseLikeApi(RecycleBinQueryDto, { page: '2', limit: '50' }, 'query')).resolves.toMatchObject({ page: 2, limit: 50 });
    await expect(invalidPropertiesLikeApi(RecycleBinQueryDto, { page: '0', limit: '51' }, 'query')).resolves.toEqual(['page', 'limit']);
  });

  it('needs between one and a hundred positive entry IDs', async () => {
    await expect(invalidSelection([3, 4])).resolves.toEqual([]);
    await expect(parseLikeApi(RecycleBinSelectionDto, { ids: [3, '4'] })).resolves.toEqual({ ids: [3, 4] });
    await expect(invalidSelection([])).resolves.toEqual(['ids']);
    await expect(invalidSelection([0, 1.5])).resolves.toEqual(['ids']);
    await expect(invalidSelection([''])).resolves.toEqual(['ids']);
    await expect(invalidSelection([true])).resolves.toEqual(['ids']);
    await expect(invalidSelection(3)).resolves.toEqual(['ids']);
    await expect(invalidSelection(Array.from({ length: 101 }, (_, index) => index + 1))).resolves.toEqual(['ids']);
  });

  it('restores at the end of the day unless an in-place undo is asked for', async () => {
    await expect(parseLikeApi(RecycleBinRestoreDto, { ids: [3] })).resolves.toEqual({ ids: [3] });
    await expect(parseLikeApi(RecycleBinRestoreDto, { ids: [3], inPlace: true })).resolves.toEqual({ ids: [3], inPlace: true });
    await expect(invalidPropertiesLikeApi(RecycleBinRestoreDto, { ids: [3], inPlace: 'yes' })).resolves.toEqual(['inPlace']);
    await expect(invalidPropertiesLikeApi(RecycleBinRestoreDto, { ids: [] })).resolves.toEqual(['ids']);
  });
});
