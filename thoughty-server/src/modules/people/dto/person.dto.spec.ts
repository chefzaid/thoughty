import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MergePersonDto, PERSON_NAME_MAX_LENGTH, UpdatePersonDto } from './person.dto';

async function invalidProperties(dto: object): Promise<string[]> {
  return (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((error) => error.property);
}

describe('person DTOs', () => {
  it('takes a trimmed name of 1 to 80 characters', async () => {
    const rename = (name: unknown) => plainToInstance(UpdatePersonDto, { name });

    expect(rename('  Marie Curie ').name).toBe('Marie Curie');
    await expect(invalidProperties(rename('Marie'))).resolves.toEqual([]);
    await expect(invalidProperties(rename('m'.repeat(PERSON_NAME_MAX_LENGTH)))).resolves.toEqual([]);
    await expect(invalidProperties(rename('   '))).resolves.toEqual(['name']);
    await expect(invalidProperties(rename('m'.repeat(PERSON_NAME_MAX_LENGTH + 1)))).resolves.toEqual(['name']);
    await expect(invalidProperties(rename(5))).resolves.toEqual(['name']);
    await expect(invalidProperties(plainToInstance(UpdatePersonDto, { name: 'Marie', handles: ['m'] }))).resolves.toEqual(['handles']);
  });

  it('takes the duplicate to merge by its ID', async () => {
    const merge = (duplicateId: unknown) => plainToInstance(MergePersonDto, { duplicateId });

    await expect(invalidProperties(merge(14))).resolves.toEqual([]);
    await expect(invalidProperties(merge(0))).resolves.toEqual(['duplicateId']);
    await expect(invalidProperties(merge('14'))).resolves.toEqual(['duplicateId']);
  });
});
