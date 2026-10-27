import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDiaryDto, UpdateDiaryDto } from './diaries.dto';

async function invalidProperties(dto: object): Promise<string[]> {
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

const update = (body: object) => plainToInstance(UpdateDiaryDto, { name: 'Work', ...body });

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
    await expect(invalidProperties(update(body))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(CreateDiaryDto, { name: 'Work', ...body }))).resolves.toEqual([]);
  });

  it.each([
    [{ goalType: 'pages_per_month', goalTarget: 3 }, ['goalType', 'goalTarget']],
    [{ goalType: 'entries_per_week' }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 0 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 51 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: 2.5 }, ['goalTarget']],
    [{ goalType: 'entries_per_week', goalTarget: '3' }, ['goalTarget']],
    [{ goalType: 'words_per_day', goalTarget: 9 }, ['goalTarget']],
    [{ goalType: 'words_per_day', goalTarget: 10001 }, ['goalTarget']],
    [{ goalTarget: 3 }, ['goalTarget']],
    [{ goalType: null, goalTarget: 3 }, ['goalTarget']],
  ])('rejects %j', async (body, properties) => {
    await expect(invalidProperties(update(body))).resolves.toEqual(properties);
  });
});
