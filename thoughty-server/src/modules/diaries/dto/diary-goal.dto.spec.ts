import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateDiaryDto, UpdateDiaryDto } from './diaries.dto';

const invalidOnUpdate = (body: object) => invalidPropertiesLikeApi(UpdateDiaryDto, { name: 'Work', ...body });

describe('diary goal fields', () => {
  it.each([
    [{}],
    [{ goalType: null }],
    [{ goalType: null, goalTarget: null }],
    [{ goalType: 'entries_per_week', goalTarget: 1 }],
    [{ goalType: 'entries_per_week', goalTarget: 50 }],
    [{ goalType: 'words_per_day', goalTarget: 10 }],
    [{ goalType: 'words_per_day', goalTarget: 10000 }],
  ])('accepts %j', async (body) => {
    await expect(invalidOnUpdate(body)).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(CreateDiaryDto, { name: 'Work', ...body })).resolves.toEqual([]);
  });

  it('reads a target written as digits, like every number the API takes', async () => {
    await expect(parseLikeApi(UpdateDiaryDto, { name: 'Work', goalType: 'entries_per_week', goalTarget: '3' })).resolves.toMatchObject({ goalTarget: 3 });
  });

  it.each([
    [{ goalType: 'pages_per_month', goalTarget: 3 }, ['goalType', 'goalTarget']],
    [{ goalType: 'entries_per_week' }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 0 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 51 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 2.5 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: '' }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: '3.0' }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: true }, ['goalTarget']],
    [{ goalType: 'words_per_day', goalTarget: 9 }, ['goalTarget']],
    [{ goalType: 'words_per_day', goalTarget: 10001 }, ['goalTarget']],
    [{ goalTarget: 3 }, ['goalTarget']],
    [{ goalType: null, goalTarget: 3 }, ['goalTarget']],
  ])('rejects %j', async (body, properties) => {
    await expect(invalidOnUpdate(body)).resolves.toEqual(properties);
  });
});
