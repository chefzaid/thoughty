import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFeatureRequestDto } from './feature-requests.dto';

describe('CreateFeatureRequestDto', () => {
  it('trims and accepts bounded request content', async () => {
    const dto = plainToInstance(CreateFeatureRequestDto, {
      title: '  Mood calendar  ',
      details: '  Show patterns by month.  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual({
      title: 'Mood calendar',
      details: 'Show patterns by month.',
    });
  });

  it('rejects empty, short, and oversized content', async () => {
    const dto = plainToInstance(CreateFeatureRequestDto, {
      title: '  ',
      details: 'x'.repeat(2001),
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(['details', 'title']);
  });
});
