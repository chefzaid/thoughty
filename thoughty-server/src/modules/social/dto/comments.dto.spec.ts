import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateEntryCommentDto } from './comments.dto';

describe('CreateEntryCommentDto', () => {
  it('trims and accepts a bounded comment', async () => {
    await expect(parseLikeApi(CreateEntryCommentDto, { content: '  Lovely thought.  ' })).resolves.toEqual({ content: 'Lovely thought.' });
  });

  it.each([['   '], ['x'.repeat(1001)], [42], [{ text: 'Lovely' }]])('rejects %p', async (content) => {
    await expect(invalidPropertiesLikeApi(CreateEntryCommentDto, { content })).resolves.toEqual(['content']);
  });
});
