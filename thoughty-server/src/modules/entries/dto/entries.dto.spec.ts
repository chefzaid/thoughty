import { Type } from '@nestjs/common';
import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { BulkOperationDto, CreateEntryDto, GetEntriesQueryDto, ReorderEntriesDto, UpdateEntryDto, UpdateEntryTaskDto } from './entries.dto';

/** The properties the API refuses; GetEntriesQueryDto arrives as a query string, the others as JSON bodies. */
const invalidProperties = (dto: Type<object>, plain: object) =>
  invalidPropertiesLikeApi(dto, plain, dto === GetEntriesQueryDto ? 'query' : 'body');

describe('GetEntriesQueryDto search options', () => {
  it('accepts a search with operators and either result order', async () => {
    await expect(invalidProperties(GetEntriesQueryDto, { search: '"morning run" -rain OR swim', sort: 'relevance' })).resolves.toEqual([]);
    await expect(invalidProperties(GetEntriesQueryDto, { search: 'walk', sort: 'date' })).resolves.toEqual([]);
    await expect(parseLikeApi(GetEntriesQueryDto, { sort: '' }, 'query')).resolves.toMatchObject({ sort: undefined });
  });

  it('rejects an unknown order and a search over 500 characters', async () => {
    await expect(invalidProperties(GetEntriesQueryDto, { sort: 'random' })).resolves.toEqual(['sort']);
    await expect(invalidProperties(GetEntriesQueryDto, { search: 'a'.repeat(501) })).resolves.toEqual([
      'search',
    ]);
  });
});

describe('entry title and time of day', () => {
  const base = { text: 'Text', tags: ['tag'], date: '2024-01-15' };

  it('accepts an optional one-line title and a 24-hour time, or null to remove them', async () => {
    await expect(invalidProperties(CreateEntryDto, { ...base, title: 'A walk', timeOfDay: '23:59' })).resolves.toEqual([]);
    await expect(invalidProperties(UpdateEntryDto, { ...base, title: null, timeOfDay: null })).resolves.toEqual([]);
    await expect(invalidProperties(UpdateEntryDto, { ...base, timeOfDay: '' })).resolves.toEqual([]);
    await expect(invalidProperties(CreateEntryDto, base)).resolves.toEqual([]);
  });

  it('rejects titles over 200 characters or on several lines, and times that are not HH:MM', async () => {
    await expect(invalidProperties(CreateEntryDto, { ...base, title: 'a'.repeat(201) })).resolves.toEqual(['title']);
    await expect(invalidProperties(CreateEntryDto, { ...base, title: 'one\ntwo' })).resolves.toEqual(['title']);
    await expect(invalidProperties(UpdateEntryDto, { ...base, timeOfDay: '24:00' })).resolves.toEqual(['timeOfDay']);
    await expect(invalidProperties(UpdateEntryDto, { ...base, timeOfDay: '8:30' })).resolves.toEqual(['timeOfDay']);
  });
});

describe('entry mood check-in', () => {
  const base = { text: 'Text', tags: ['tag'], date: '2024-01-15' };

  it('accepts a mood from 1 to 5 and up to ten feeling words, or null and an empty list to remove them', async () => {
    await expect(invalidProperties(CreateEntryDto, { ...base, mood: 1, feelings: ['calm', 'my own word'] })).resolves.toEqual([]);
    await expect(invalidProperties(UpdateEntryDto, { ...base, mood: 5, feelings: Array.from({ length: 10 }, (_, index) => `w${index}`) })).resolves.toEqual([]);
    await expect(invalidProperties(UpdateEntryDto, { ...base, mood: null, feelings: [] })).resolves.toEqual([]);
  });

  it('rejects moods off the scale and too many or too long feelings', async () => {
    await expect(invalidProperties(CreateEntryDto, { ...base, mood: 0 })).resolves.toEqual(['mood']);
    await expect(invalidProperties(CreateEntryDto, { ...base, mood: 6 })).resolves.toEqual(['mood']);
    await expect(invalidProperties(CreateEntryDto, { ...base, mood: 2.5 })).resolves.toEqual(['mood']);
    await expect(invalidProperties(UpdateEntryDto, { ...base, feelings: Array.from({ length: 11 }, (_, index) => `w${index}`) })).resolves.toEqual(['feelings']);
    await expect(invalidProperties(UpdateEntryDto, { ...base, feelings: ['x'.repeat(41)] })).resolves.toEqual(['feelings']);
  });

  it('filters by mood levels, any mood, or no mood', async () => {
    for (const mood of ['3', '1,2', '4,5', 'any', 'none', '']) {
      await expect(invalidProperties(GetEntriesQueryDto, { mood })).resolves.toEqual([]);
    }
    for (const mood of ['0', '6', 'good', '1,,2', '1;2']) {
      await expect(invalidProperties(GetEntriesQueryDto, { mood })).resolves.toEqual(['mood']);
    }
  });
});

describe('UpdateEntryTaskDto', () => {
  it('accepts a line counted from 0 and whether the task is done', async () => {
    await expect(invalidProperties(UpdateEntryTaskDto, { line: 0, checked: true })).resolves.toEqual([]);
    await expect(invalidProperties(UpdateEntryTaskDto, { line: 12, checked: false })).resolves.toEqual([]);
  });

  it('rejects a negative or fractional line and a missing state or one other than true or false', async () => {
    await expect(invalidProperties(UpdateEntryTaskDto, { line: -1, checked: true })).resolves.toEqual(['line']);
    await expect(invalidProperties(UpdateEntryTaskDto, { line: 1.5, checked: true })).resolves.toEqual(['line']);
    await expect(invalidProperties(UpdateEntryTaskDto, { line: 1, checked: 'yes' })).resolves.toEqual(['checked']);
    await expect(invalidProperties(UpdateEntryTaskDto, { line: 1 })).resolves.toEqual(['checked']);
  });
});

describe('entry diary and IDs in JSON bodies', () => {
  const base = { text: 'Text', tags: ['tag'], date: '2024-01-15' };

  it('takes a diary as a whole number, or as digits like the query strings', async () => {
    await expect(parseLikeApi(CreateEntryDto, { ...base, diaryId: 2 })).resolves.toMatchObject({ diaryId: 2 });
    await expect(parseLikeApi(CreateEntryDto, { ...base, diaryId: '2' })).resolves.toMatchObject({ diaryId: 2 });
    await expect(parseLikeApi(BulkOperationDto, { ids: [3, '4'], action: 'move', diaryId: '5' })).resolves.toMatchObject({ ids: [3, 4], diaryId: 5 });
  });

  it.each(['', ' 2', '1.5', 1.5, true, '0x2', '1e1', [2]])('refuses the diary %j instead of reading it as a number', async (diaryId) => {
    await expect(invalidProperties(CreateEntryDto, { ...base, diaryId })).resolves.toEqual(['diaryId']);
    await expect(invalidProperties(BulkOperationDto, { ids: [1], action: 'move', diaryId })).resolves.toEqual(['diaryId']);
  });

  it.each([[['']], [[true]], [[1.5]], [['3', 'x']], ['3']])('refuses the entry IDs %j', async (ids) => {
    await expect(invalidProperties(BulkOperationDto, { ids, action: 'delete' })).resolves.toEqual(['ids']);
    await expect(invalidProperties(ReorderEntriesDto, { date: '2024-01-15', orderedIds: ids })).resolves.toEqual(['orderedIds']);
  });

  it('takes the text and tags only as strings', async () => {
    await expect(invalidProperties(CreateEntryDto, { ...base, text: 5 })).resolves.toEqual(['text']);
    await expect(invalidProperties(CreateEntryDto, { ...base, text: { body: 'Text' } })).resolves.toEqual(['text']);
    await expect(invalidProperties(CreateEntryDto, { ...base, tags: [7] })).resolves.toEqual(['tags']);
  });
});
