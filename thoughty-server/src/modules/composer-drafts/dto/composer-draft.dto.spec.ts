import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { DiscardComposerDraftQueryDto, SaveComposerDraftDto } from './composer-draft.dto';

const draft = { text: 'We walked', title: 'Walk', tags: ['walks'], format: 'plain', mood: 4, feelings: ['calm'], baseRevision: 2 };
const invalidProperties = (body: object) => invalidPropertiesLikeApi(SaveComposerDraftDto, body);

describe('composer draft DTOs', () => {
  it('takes a draft with every field, or with none of the optional details', async () => {
    await expect(invalidProperties(draft)).resolves.toEqual([]);
    await expect(invalidProperties({ ...draft, text: '', title: null, tags: [], mood: null, feelings: [], baseRevision: null }))
      .resolves.toEqual([]);
    await expect(parseLikeApi(SaveComposerDraftDto, { ...draft, baseRevision: '2', mood: '4' }))
      .resolves.toMatchObject({ baseRevision: 2, mood: 4 });
  });

  it('keeps the entry limits', async () => {
    await expect(invalidProperties({ ...draft, text: 'x'.repeat(50_000) })).resolves.toEqual([]);
    await expect(invalidProperties({ ...draft, text: 'x'.repeat(50_001) })).resolves.toEqual(['text']);
    await expect(invalidProperties({ ...draft, title: 'x'.repeat(201) })).resolves.toEqual(['title']);
    await expect(invalidProperties({ ...draft, tags: Array.from({ length: 21 }, (_, index) => `t${index}`) })).resolves.toEqual(['tags']);
    await expect(invalidProperties({ ...draft, tags: ['x'.repeat(51)] })).resolves.toEqual(['tags']);
    await expect(invalidProperties({ ...draft, feelings: Array.from({ length: 11 }, (_, index) => `f${index}`) })).resolves.toEqual(['feelings']);
  });

  it.each([
    ['text', undefined],
    ['text', 7],
    ['title', 'Two\nlines'],
    ['title', undefined],
    ['tags', 'walks'],
    ['format', 'html'],
    ['mood', 0],
    ['mood', 6],
    ['mood', 2.5],
    ['feelings', [3]],
    ['baseRevision', 0],
    ['baseRevision', undefined],
    ['baseRevision', '1.5'],
  ])('refuses %s set to %j', async (field, value) => {
    await expect(invalidProperties({ ...draft, [field]: value })).resolves.toEqual([field]);
  });

  it('takes an optional positive revision to discard at', async () => {
    await expect(parseLikeApi(DiscardComposerDraftQueryDto, { revision: '3' }, 'query')).resolves.toMatchObject({ revision: 3 });
    await expect(invalidPropertiesLikeApi(DiscardComposerDraftQueryDto, {}, 'query')).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(DiscardComposerDraftQueryDto, { revision: '0' }, 'query')).resolves.toEqual(['revision']);
    await expect(invalidPropertiesLikeApi(DiscardComposerDraftQueryDto, { revision: 'x' }, 'query')).resolves.toEqual(['revision']);
  });
});
