import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEntryCommentDto } from './comments.dto';

describe('CreateEntryCommentDto', () => {
  it('trims and accepts a bounded comment', async () => {
    const dto = plainToInstance(CreateEntryCommentDto, { content: '  Lovely thought.  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.content).toBe('Lovely thought.');
  });

  it.each([['   '], ['x'.repeat(1001)], [42]])('rejects %p', async (content) => {
    const dto = plainToInstance(CreateEntryCommentDto, { content });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(['content']);
  });
});
