import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnswerMemoirQuestionDto, StartMemoirDto, UpdateMemoirDto } from './memoir.dto';

async function invalidProperties(errors: Promise<{ property: string }[]>): Promise<string[]> {
  return (await errors).map((error) => error.property);
}

describe('memoir DTOs', () => {
  const start = { emailEnabled: true, deliveryWeekday: 0, timeZone: 'Europe/Paris' };

  it('starts in a new diary named by the writer, trimmed', async () => {
    const dto = plainToInstance(StartMemoirDto, { ...start, diaryName: '  My memoir  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.diaryName).toBe('My memoir');
  });

  it('starts in an existing diary without needing a name', async () => {
    const dto = plainToInstance(StartMemoirDto, { ...start, diaryId: '4' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.diaryId).toBe(4);
  });

  it('requires a diary name or id and a weekday from 0 to 6', async () => {
    await expect(invalidProperties(validate(plainToInstance(StartMemoirDto, start)))).resolves.toEqual(['diaryName']);
    await expect(
      invalidProperties(validate(plainToInstance(StartMemoirDto, { ...start, diaryName: 'Memoir', deliveryWeekday: 7 }))),
    ).resolves.toEqual(['deliveryWeekday']);
  });

  it('accepts partial settings updates and rejects unknown statuses', async () => {
    await expect(validate(plainToInstance(UpdateMemoirDto, { status: 'paused' }))).resolves.toHaveLength(0);
    await expect(invalidProperties(validate(plainToInstance(UpdateMemoirDto, { status: 'done' })))).resolves.toEqual([
      'status',
    ]);
  });

  it('trims answers and bounds question ids and attachments', async () => {
    const dto = plainToInstance(AnswerMemoirQuestionDto, {
      questionId: 'childhood-home',
      text: '  A fig tree in the yard.  ',
      attachmentIds: [3],
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.text).toBe('A fig tree in the yard.');

    const invalid = plainToInstance(AnswerMemoirQuestionDto, {
      questionId: '../etc',
      text: 'x',
      attachmentIds: [1, 2, 3, 4, 5, 6],
    });
    await expect(invalidProperties(validate(invalid))).resolves.toEqual(['questionId', 'attachmentIds']);
  });
});
