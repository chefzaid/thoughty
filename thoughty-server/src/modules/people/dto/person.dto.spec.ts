import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { MergePersonDto, PERSON_NAME_MAX_LENGTH, UpdatePersonDto } from './person.dto';

describe('person DTOs', () => {
  it('takes a trimmed name of 1 to 80 characters', async () => {
    const rename = (name: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name });

    await expect(parseLikeApi(UpdatePersonDto, { name: '  Marie Curie ' })).resolves.toMatchObject({ name: 'Marie Curie' });
    await expect(rename('Marie')).resolves.toEqual([]);
    await expect(rename('m'.repeat(PERSON_NAME_MAX_LENGTH))).resolves.toEqual([]);
    await expect(rename('   ')).resolves.toEqual(['name']);
    await expect(rename('m'.repeat(PERSON_NAME_MAX_LENGTH + 1))).resolves.toEqual(['name']);
    await expect(rename(5)).resolves.toEqual(['name']);
    await expect(rename({ first: 'Marie' })).resolves.toEqual(['name']);
    await expect(invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', handles: ['m'] })).resolves.toEqual(['handles']);
  });

  it('takes the duplicate to merge by its ID, as a number or as digits', async () => {
    const merge = (duplicateId: unknown) => invalidPropertiesLikeApi(MergePersonDto, { duplicateId });

    await expect(merge(14)).resolves.toEqual([]);
    await expect(parseLikeApi(MergePersonDto, { duplicateId: '14' })).resolves.toEqual({ duplicateId: 14 });
    for (const duplicateId of [0, '', true, '1e1', [14]]) {
      await expect(merge(duplicateId)).resolves.toEqual(['duplicateId']);
    }
  });
});
