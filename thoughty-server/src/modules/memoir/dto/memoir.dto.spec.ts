import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { AnswerMemoirQuestionDto, StartMemoirDto, UpdateMemoirDto } from './memoir.dto';

describe('memoir DTOs', () => {
  const start = { emailEnabled: true, deliveryWeekday: 0, timeZone: 'Europe/Paris' };

  it('starts in a new diary named by the writer, trimmed', async () => {
    await expect(parseLikeApi(StartMemoirDto, { ...start, diaryName: '  My memoir  ' })).resolves.toMatchObject({ diaryName: 'My memoir' });
  });

  it('starts in an existing diary without needing a name', async () => {
    await expect(parseLikeApi(StartMemoirDto, { ...start, diaryId: 4 })).resolves.toMatchObject({ diaryId: 4 });
    await expect(parseLikeApi(StartMemoirDto, { ...start, diaryId: '4' })).resolves.toMatchObject({ diaryId: 4 });
  });

  it('requires a diary name or id and a weekday from 0 to 6', async () => {
    await expect(invalidPropertiesLikeApi(StartMemoirDto, start)).resolves.toEqual(['diaryName']);
    await expect(invalidPropertiesLikeApi(StartMemoirDto, { ...start, diaryName: 'Memoir', deliveryWeekday: 7 })).resolves.toEqual([
      'deliveryWeekday',
    ]);
  });

  it('refuses a diary or weekday that is not a whole number instead of reading it as one', async () => {
    await expect(invalidPropertiesLikeApi(StartMemoirDto, { ...start, diaryId: '' })).resolves.toEqual(['diaryId']);
    await expect(invalidPropertiesLikeApi(StartMemoirDto, { ...start, diaryId: true })).resolves.toEqual(['diaryId']);
    await expect(invalidPropertiesLikeApi(StartMemoirDto, { ...start, diaryName: 'Memoir', deliveryWeekday: '' })).resolves.toEqual([
      'deliveryWeekday',
    ]);
    await expect(invalidPropertiesLikeApi(UpdateMemoirDto, { diaryId: '2.5' })).resolves.toEqual(['diaryId']);
  });

  it('accepts partial settings updates and rejects unknown statuses', async () => {
    await expect(invalidPropertiesLikeApi(UpdateMemoirDto, { status: 'paused' })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(UpdateMemoirDto, { status: 'done' })).resolves.toEqual(['status']);
  });

  it('trims answers and bounds question ids and attachments', async () => {
    await expect(
      parseLikeApi(AnswerMemoirQuestionDto, { questionId: 'childhood-home', text: '  A fig tree in the yard.  ', attachmentIds: [3], eraId: 2 }),
    ).resolves.toMatchObject({ text: 'A fig tree in the yard.', attachmentIds: [3], eraId: 2 });

    await expect(
      invalidPropertiesLikeApi(AnswerMemoirQuestionDto, { questionId: '../etc', text: 'x', attachmentIds: [1, 2, 3, 4, 5, 6], eraId: 0 }),
    ).resolves.toEqual(['questionId', 'attachmentIds', 'eraId']);
    await expect(invalidPropertiesLikeApi(AnswerMemoirQuestionDto, { questionId: 'childhood-home', text: 'x', attachmentIds: [''] }))
      .resolves.toEqual(['attachmentIds']);
  });
});
