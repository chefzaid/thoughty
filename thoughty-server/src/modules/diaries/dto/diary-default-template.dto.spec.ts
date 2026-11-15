import { invalidPropertiesLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateDiaryDto, UpdateDiaryDto } from './diaries.dto';

describe('diary default template field', () => {
  it.each([
    [{}],
    [{ defaultTemplateId: null }],
    [{ defaultTemplateId: 'builtin-gratitude' }],
    [{ defaultTemplateId: 'custom-1767225600000' }],
    [{ defaultTemplateId: 'a'.repeat(100) }],
  ])('accepts %j', async (body) => {
    await expect(invalidPropertiesLikeApi(CreateDiaryDto, { name: 'Work', ...body })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(UpdateDiaryDto, { name: 'Work', ...body })).resolves.toEqual([]);
  });

  it.each([
    [{ defaultTemplateId: '' }],
    [{ defaultTemplateId: 'a'.repeat(101) }],
    [{ defaultTemplateId: 'custom 1' }],
    [{ defaultTemplateId: '<script>' }],
    [{ defaultTemplateId: 42 }],
  ])('rejects %j', async (body) => {
    await expect(invalidPropertiesLikeApi(UpdateDiaryDto, { name: 'Work', ...body })).resolves.toEqual(['defaultTemplateId']);
  });
});
