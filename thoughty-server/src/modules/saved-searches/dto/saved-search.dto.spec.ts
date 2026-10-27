import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSavedSearchDto, RenameSavedSearchDto } from './saved-search.dto';

const filters = {
  search: '"long walk" -rain',
  searchMode: 'keyword',
  sort: 'relevance',
  tags: ['family'],
  date: '2019-07-14',
  visibility: 'all',
  archiveStatus: 'active',
  favorites: true,
  mood: '4,5',
};

async function invalidProperties(dto: object): Promise<string[]> {
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((error) => (error.children?.length
    ? error.children.map((child) => `${error.property}.${child.property}`)
    : [error.property]));
}

const create = (body: object) => plainToInstance(CreateSavedSearchDto, body);

describe('saved search DTOs', () => {
  it('accepts a full set of filters with a diary or all diaries', async () => {
    await expect(invalidProperties(create({ name: 'Family', diaryId: 2, filters }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Family', diaryId: null, filters: { ...filters, date: null, mood: '' } }))).resolves.toEqual([]);
  });

  it('trims the name and needs one of 1 to 80 characters', async () => {
    const dto = create({ name: '  Family  ', diaryId: null, filters });
    expect(dto.name).toBe('Family');

    await expect(invalidProperties(create({ name: '   ', diaryId: null, filters }))).resolves.toEqual(['name']);
    await expect(invalidProperties(create({ name: 'x'.repeat(81), diaryId: null, filters }))).resolves.toEqual(['name']);
    await expect(invalidProperties(create({ name: 7, diaryId: null, filters }))).resolves.toEqual(['name']);
    await expect(invalidProperties(plainToInstance(RenameSavedSearchDto, { name: ' 2019 ' }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(RenameSavedSearchDto, { name: '' }))).resolves.toEqual(['name']);
  });

  it('takes an optional life era: a positive ID, null, or none for searches saved before eras', async () => {
    await expect(invalidProperties(create({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: 3 } }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: null } }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: 0 } }))).resolves.toEqual(['filters.eraId']);
    await expect(invalidProperties(create({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: '3' } }))).resolves.toEqual(['filters.eraId']);
    await expect(invalidProperties(create({ name: 'Marie', diaryId: null, filters: { ...filters, personId: 12 } }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Marie', diaryId: null, filters: { ...filters, personId: null } }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Marie', diaryId: null, filters: { ...filters, personId: 0 } }))).resolves.toEqual(['filters.personId']);
  });

  it('needs a positive diary ID or null', async () => {
    await expect(invalidProperties(create({ name: 'Family', filters }))).resolves.toEqual(['diaryId']);
    await expect(invalidProperties(create({ name: 'Family', diaryId: 0, filters }))).resolves.toEqual(['diaryId']);
    await expect(invalidProperties(create({ name: 'Family', diaryId: '2', filters }))).resolves.toEqual(['diaryId']);
  });

  it.each([
    ['search', 'x'.repeat(501)],
    ['searchMode', 'fuzzy'],
    ['sort', 'oldest'],
    ['tags', Array.from({ length: 21 }, (_, index) => `tag${index}`)],
    ['tags', ['']],
    ['tags', ['x'.repeat(51)]],
    ['date', '2019-02-30'],
    ['date', '2019'],
    ['date', undefined],
    ['visibility', 'friends'],
    ['archiveStatus', 'deleted'],
    ['favorites', 'yes'],
    ['mood', '6'],
    ['mood', '4,'],
  ])('refuses %s set to %j', async (field, value) => {
    await expect(invalidProperties(create({ name: 'Family', diaryId: null, filters: { ...filters, [field]: value } })))
      .resolves.toEqual([`filters.${field}`]);
  });

  it('refuses filters it does not know and filters that are not an object', async () => {
    await expect(invalidProperties(create({ name: 'Family', diaryId: null, filters: { ...filters, era: 'University' } })))
      .resolves.toEqual(['filters.era']);
    await expect(invalidProperties(create({ name: 'Family', diaryId: null, filters: 'family' }))).resolves.toEqual(['filters']);
  });
});
