import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateFeatureRequestDto } from './feature-requests.dto';

describe('CreateFeatureRequestDto', () => {
  it('trims and accepts bounded request content', async () => {
    await expect(parseLikeApi(CreateFeatureRequestDto, { title: '  Mood calendar  ', details: '  Show patterns by month.  ' })).resolves.toEqual({
      title: 'Mood calendar',
      details: 'Show patterns by month.',
    });
  });

  it('rejects empty, short, and oversized content', async () => {
    await expect(invalidPropertiesLikeApi(CreateFeatureRequestDto, { title: '  ', details: 'x'.repeat(2001) })).resolves.toEqual([
      'title',
      'details',
    ]);
    await expect(invalidPropertiesLikeApi(CreateFeatureRequestDto, { title: 12345, details: 'Show patterns by month.', votes: 3 })).resolves.toEqual(['votes', 'title']);
  });
});
