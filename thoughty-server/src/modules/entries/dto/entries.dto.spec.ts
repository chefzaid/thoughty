import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetEntriesQueryDto } from './entries.dto';

async function invalidProperties(dto: object): Promise<string[]> {
  return (await validate(dto)).map((error) => error.property);
}

describe('GetEntriesQueryDto search options', () => {
  it('accepts a search with operators and either result order', async () => {
    const byRelevance = plainToInstance(GetEntriesQueryDto, { search: '"morning run" -rain OR swim', sort: 'relevance' });
    const byDate = plainToInstance(GetEntriesQueryDto, { search: 'walk', sort: 'date' });

    await expect(invalidProperties(byRelevance)).resolves.toEqual([]);
    await expect(invalidProperties(byDate)).resolves.toEqual([]);
    expect(plainToInstance(GetEntriesQueryDto, { sort: '' }).sort).toBeUndefined();
  });

  it('rejects an unknown order and a search over 500 characters', async () => {
    await expect(invalidProperties(plainToInstance(GetEntriesQueryDto, { sort: 'random' }))).resolves.toEqual(['sort']);
    await expect(invalidProperties(plainToInstance(GetEntriesQueryDto, { search: 'a'.repeat(501) }))).resolves.toEqual([
      'search',
    ]);
  });
});
