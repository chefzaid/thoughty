import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEntryDto, GetEntriesQueryDto, UpdateEntryDto } from './entries.dto';

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

describe('entry title and time of day', () => {
  const base = { text: 'Text', tags: ['tag'], date: '2024-01-15' };

  it('accepts an optional one-line title and a 24-hour time, or null to remove them', async () => {
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, title: 'A walk', timeOfDay: '23:59' }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, title: null, timeOfDay: null }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, timeOfDay: '' }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(CreateEntryDto, base))).resolves.toEqual([]);
  });

  it('rejects titles over 200 characters or on several lines, and times that are not HH:MM', async () => {
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, title: 'a'.repeat(201) }))).resolves.toEqual(['title']);
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, title: 'one\ntwo' }))).resolves.toEqual(['title']);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, timeOfDay: '24:00' }))).resolves.toEqual(['timeOfDay']);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, timeOfDay: '8:30' }))).resolves.toEqual(['timeOfDay']);
  });
});
