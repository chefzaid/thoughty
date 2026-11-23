import { invalidPropertiesLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateDiaryDto, UpdateDiaryDto } from './diaries.dto';

describe('diary AI mode field', () => {
  it.each([[{}], [{ aiMode: 'on' }], [{ aiMode: 'off' }]])('accepts %j', async (body) => {
    await expect(invalidPropertiesLikeApi(CreateDiaryDto, { name: 'Work', ...body })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(UpdateDiaryDto, { name: 'Work', ...body })).resolves.toEqual([]);
  });

  it.each([[{ aiMode: 'local' }], [{ aiMode: '' }], [{ aiMode: null }], [{ aiMode: true }]])('rejects %j', async (body) => {
    await expect(invalidPropertiesLikeApi(CreateDiaryDto, { name: 'Work', ...body })).resolves.toEqual(['aiMode']);
    await expect(invalidPropertiesLikeApi(UpdateDiaryDto, { name: 'Work', ...body })).resolves.toEqual(['aiMode']);
  });
});
