import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreatePersonalAccessTokenDto } from './access-token.dto';
import { PublicCreateEntryDto, PublicEntriesQueryDto } from './public-api.dto';

const token = { name: '  iPhone Shortcut ', scopes: ['entries:write'], expiresInDays: 90, timeZone: 'Europe/Paris' };

describe('CreatePersonalAccessTokenDto', () => {
  it('takes a trimmed name, known scopes, a listed lifetime or none, and an IANA time zone', async () => {
    await expect(parseLikeApi(CreatePersonalAccessTokenDto, token)).resolves.toEqual(expect.objectContaining({ name: 'iPhone Shortcut' }));
    await expect(invalidPropertiesLikeApi(CreatePersonalAccessTokenDto, { ...token, expiresInDays: null, scopes: ['entries:read', 'entries:write'] })).resolves.toEqual([]);
  });

  it.each([
    ['an empty name', { name: '   ' }, 'name'],
    ['a name over 60 characters', { name: 'x'.repeat(61) }, 'name'],
    ['a name on two lines', { name: 'a\nb' }, 'name'],
    ['no scope', { scopes: [] }, 'scopes'],
    ['an unknown scope', { scopes: ['account:write'] }, 'scopes'],
    ['a repeated scope', { scopes: ['entries:read', 'entries:read'] }, 'scopes'],
    ['an unlisted lifetime', { expiresInDays: 7 }, 'expiresInDays'],
    ['a missing lifetime', { expiresInDays: undefined }, 'expiresInDays'],
    ['an offset for a time zone', { timeZone: '+05:30' }, 'timeZone'],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }, 'timeZone'],
  ])('refuses %s', async (_case, changes, property) => {
    await expect(invalidPropertiesLikeApi(CreatePersonalAccessTokenDto, { ...token, ...changes })).resolves.toEqual([property]);
  });
});

describe('PublicCreateEntryDto', () => {
  it('takes a text alone, with the composer’s optional fields', async () => {
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, { text: 'Hello' })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, {
      text: 'Hello', title: 'Hi', date: '2026-11-21', timeOfDay: '08:30', tags: ['walk'], mood: 4, feelings: ['calm'], format: 'markdown', diaryId: 2,
    })).resolves.toEqual([]);
  });

  it('refuses a visibility or a seal: an entry written through the API is always private', async () => {
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, { text: 'Hello', visibility: 'public' })).resolves.toEqual(['visibility']);
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, { text: 'Hello', seal: { until: '2030-01-01' } })).resolves.toEqual(['seal']);
  });

  it('refuses a missing text and too many tags', async () => {
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, {})).resolves.toEqual(['text']);
    await expect(invalidPropertiesLikeApi(PublicCreateEntryDto, { text: 'a', tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })).resolves.toEqual(['tags']);
  });
});

describe('PublicEntriesQueryDto', () => {
  it('reads the page size from the query, up to 50', async () => {
    await expect(parseLikeApi(PublicEntriesQueryDto, { limit: '5', diaryId: '2' }, 'query')).resolves.toEqual(expect.objectContaining({ limit: 5, diaryId: 2 }));
    await expect(invalidPropertiesLikeApi(PublicEntriesQueryDto, { limit: '51' }, 'query')).resolves.toEqual(['limit']);
    await expect(invalidPropertiesLikeApi(PublicEntriesQueryDto, { around: '3' }, 'query')).resolves.toEqual(['around']);
  });
});
