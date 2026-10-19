import { MemoirController } from './memoir.controller';

describe('MemoirController', () => {
  const user = { userId: 4 } as never;
  const memoirService = {
    getOverview: jest.fn().mockResolvedValue({ program: null }),
    start: jest.fn().mockResolvedValue({ program: { status: 'active' } }),
    update: jest.fn().mockResolvedValue({ program: { status: 'paused' } }),
    leave: jest.fn().mockResolvedValue({ success: true }),
    skip: jest.fn().mockResolvedValue({ program: { currentQuestionId: 'childhood-play' } }),
  };
  const answersService = { answer: jest.fn().mockResolvedValue({ questionId: 'childhood-home', entryId: 9 }) };
  const controller = new MemoirController(memoirService as never, answersService as never);

  it('scopes every memoir action to the authenticated writer', async () => {
    const start = { diaryName: 'My memoir', emailEnabled: true, deliveryWeekday: 0, timeZone: 'UTC' };
    const answer = { questionId: 'childhood-home', text: 'A fig tree.' };

    await expect(controller.getOverview(user)).resolves.toEqual({ program: null });
    await expect(controller.start(user, start)).resolves.toEqual({ program: { status: 'active' } });
    await expect(controller.update(user, { status: 'paused' })).resolves.toEqual({ program: { status: 'paused' } });
    await expect(controller.skip(user)).resolves.toEqual({ program: { currentQuestionId: 'childhood-play' } });
    await expect(controller.answer(user, answer)).resolves.toEqual({ questionId: 'childhood-home', entryId: 9 });
    await expect(controller.leave(user)).resolves.toEqual({ success: true });

    expect(memoirService.getOverview).toHaveBeenCalledWith(4);
    expect(memoirService.start).toHaveBeenCalledWith(4, start);
    expect(memoirService.update).toHaveBeenCalledWith(4, { status: 'paused' });
    expect(memoirService.skip).toHaveBeenCalledWith(4);
    expect(answersService.answer).toHaveBeenCalledWith(4, answer);
    expect(memoirService.leave).toHaveBeenCalledWith(4);
  });
});
