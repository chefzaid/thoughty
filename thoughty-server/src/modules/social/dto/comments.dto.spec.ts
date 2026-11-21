import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateEntryCommentDto, SetCommentPolicyDto } from './comments.dto';

describe('CreateEntryCommentDto', () => {
  it('trims and accepts a bounded comment', async () => {
    await expect(parseLikeApi(CreateEntryCommentDto, { content: '  Lovely thought.  ' })).resolves.toEqual({ content: 'Lovely thought.' });
  });

  it.each([['   '], ['x'.repeat(1001)], [42], [{ text: 'Lovely' }]])('rejects %p', async (content) => {
    await expect(invalidPropertiesLikeApi(CreateEntryCommentDto, { content })).resolves.toEqual(['content']);
  });
});

describe('SetCommentPolicyDto', () => {
  it.each([['everyone'], ['followers'], ['closed']])('accepts %p', async (policy) => {
    await expect(parseLikeApi(SetCommentPolicyDto, { policy })).resolves.toEqual({ policy });
  });

  it.each([['friends'], [''], [null], [1]])('rejects %p', async (policy) => {
    await expect(invalidPropertiesLikeApi(SetCommentPolicyDto, { policy })).resolves.toEqual(['policy']);
  });
});
