import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { MemoirFollowUpsDto } from './memoir-follow-ups.dto';

describe('MemoirFollowUpsDto', () => {
  it('trims the answer and takes the follow-ups already offered', async () => {
    await expect(parseLikeApi(MemoirFollowUpsDto, { questionId: 'childhood-home', text: '  A fig tree.  ', asked: ['Who planted it?'] }))
      .resolves.toMatchObject({ text: 'A fig tree.', asked: ['Who planted it?'] });
  });

  it('refuses an empty answer, a malformed question id, and too many or too long follow-ups', async () => {
    await expect(invalidPropertiesLikeApi(MemoirFollowUpsDto, { questionId: '../etc', text: '   ' })).resolves.toEqual(['questionId', 'text']);
    await expect(invalidPropertiesLikeApi(MemoirFollowUpsDto, { questionId: 'childhood-home', text: 'x', asked: Array.from({ length: 13 }, () => 'Why?') }))
      .resolves.toEqual(['asked']);
    await expect(invalidPropertiesLikeApi(MemoirFollowUpsDto, { questionId: 'childhood-home', text: 'x', asked: ['x'.repeat(201)] }))
      .resolves.toEqual(['asked']);
    await expect(invalidPropertiesLikeApi(MemoirFollowUpsDto, { questionId: 'childhood-home', text: 'x', asked: [3] }))
      .resolves.toEqual(['asked']);
  });
});
