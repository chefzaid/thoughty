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

describe('entry mood check-in', () => {
  const base = { text: 'Text', tags: ['tag'], date: '2024-01-15' };

  it('accepts a mood from 1 to 5 and up to ten feeling words, or null and an empty list to remove them', async () => {
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, mood: 1, feelings: ['calm', 'my own word'] }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, mood: 5, feelings: Array.from({ length: 10 }, (_, index) => `w${index}`) }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, mood: null, feelings: [] }))).resolves.toEqual([]);
  });

  it('rejects moods off the scale and too many or too long feelings', async () => {
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, mood: 0 }))).resolves.toEqual(['mood']);
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, mood: 6 }))).resolves.toEqual(['mood']);
    await expect(invalidProperties(plainToInstance(CreateEntryDto, { ...base, mood: 2.5 }))).resolves.toEqual(['mood']);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, feelings: Array.from({ length: 11 }, (_, index) => `w${index}`) }))).resolves.toEqual(['feelings']);
    await expect(invalidProperties(plainToInstance(UpdateEntryDto, { ...base, feelings: ['x'.repeat(41)] }))).resolves.toEqual(['feelings']);
  });

  it('filters by mood levels, any mood, or no mood', async () => {
    for (const mood of ['3', '1,2', '4,5', 'any', 'none', '']) {
      await expect(invalidProperties(plainToInstance(GetEntriesQueryDto, { mood }))).resolves.toEqual([]);
    }
    for (const mood of ['0', '6', 'good', '1,,2', '1;2']) {
      await expect(invalidProperties(plainToInstance(GetEntriesQueryDto, { mood }))).resolves.toEqual(['mood']);
    }
  });
});
