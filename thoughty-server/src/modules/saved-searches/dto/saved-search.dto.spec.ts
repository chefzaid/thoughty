import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
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

const invalidProperties = (body: object) => invalidPropertiesLikeApi(CreateSavedSearchDto, body);

describe('saved search DTOs', () => {
  it('accepts a full set of filters with a diary or all diaries', async () => {
    await expect(invalidProperties({ name: 'Family', diaryId: 2, filters })).resolves.toEqual([]);
    await expect(invalidProperties({ name: 'Family', diaryId: null, filters: { ...filters, date: null, mood: '' } })).resolves.toEqual([]);
  });

  it('trims the name and needs one of 1 to 80 characters', async () => {
    await expect(parseLikeApi(CreateSavedSearchDto, { name: '  Family  ', diaryId: null, filters })).resolves.toMatchObject({ name: 'Family' });

    await expect(invalidProperties({ name: '   ', diaryId: null, filters })).resolves.toEqual(['name']);
    await expect(invalidProperties({ name: 'x'.repeat(81), diaryId: null, filters })).resolves.toEqual(['name']);
    await expect(invalidProperties({ name: 7, diaryId: null, filters })).resolves.toEqual(['name']);
    await expect(invalidProperties({ name: { first: 'Family' }, diaryId: null, filters })).resolves.toEqual(['name']);
    await expect(invalidPropertiesLikeApi(RenameSavedSearchDto, { name: ' 2019 ' })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(RenameSavedSearchDto, { name: '' })).resolves.toEqual(['name']);
  });

  it('takes an optional life era: a positive ID, null, or none for searches saved before eras', async () => {
    await expect(invalidProperties({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: 3 } })).resolves.toEqual([]);
    await expect(invalidProperties({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: null } })).resolves.toEqual([]);
    await expect(invalidProperties({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: 0 } })).resolves.toEqual(['filters.eraId']);
    await expect(invalidProperties({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: '' } })).resolves.toEqual(['filters.eraId']);
    await expect(invalidProperties({ name: 'Uni', diaryId: null, filters: { ...filters, eraId: 1.5 } })).resolves.toEqual(['filters.eraId']);
    await expect(invalidProperties({ name: 'Marie', diaryId: null, filters: { ...filters, personId: 12 } })).resolves.toEqual([]);
    await expect(invalidProperties({ name: 'Marie', diaryId: null, filters: { ...filters, personId: null } })).resolves.toEqual([]);
    await expect(invalidProperties({ name: 'Marie', diaryId: null, filters: { ...filters, personId: 0 } })).resolves.toEqual(['filters.personId']);
  });

  it('needs a positive diary ID or null', async () => {
    await expect(invalidProperties({ name: 'Family', filters })).resolves.toEqual(['diaryId']);
    await expect(invalidProperties({ name: 'Family', diaryId: 0, filters })).resolves.toEqual(['diaryId']);
    for (const diaryId of ['', ' 2', '2.5', true, [2]]) {
      await expect(invalidProperties({ name: 'Family', diaryId, filters })).resolves.toEqual(['diaryId']);
    }
  });

  it('reads a diary or era ID written as digits, like every number the API takes', async () => {
    await expect(parseLikeApi(CreateSavedSearchDto, { name: 'Family', diaryId: '2', filters: { ...filters, eraId: '3' } }))
      .resolves.toMatchObject({ diaryId: 2, filters: { eraId: 3 } });
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
    await expect(invalidProperties({ name: 'Family', diaryId: null, filters: { ...filters, [field]: value } }))
      .resolves.toEqual([`filters.${field}`]);
  });

  it('refuses filters it does not know and filters that are not an object', async () => {
    await expect(invalidProperties({ name: 'Family', diaryId: null, filters: { ...filters, era: 'University' } }))
      .resolves.toEqual(['filters.era']);
    await expect(invalidProperties({ name: 'Family', diaryId: null, filters: 'family' })).resolves.toEqual(['filters']);
  });
});
