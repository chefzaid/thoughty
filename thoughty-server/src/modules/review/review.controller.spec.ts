import { ReviewController } from './review.controller';

describe('ReviewController', () => {
  const yearReviewService = { getReview: jest.fn() };
  const yearMoodService = { generate: jest.fn() };
  const weeklyReflectionService = { getWeek: jest.fn(), generate: jest.fn() };
  const controller = new ReviewController(yearReviewService as never, yearMoodService as never, weeklyReflectionService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  it('returns the review of the requested year and scope', async () => {
    yearReviewService.getReview.mockResolvedValue({ year: 2025 });

    await expect(controller.getReview(user as never, { year: 2025, diaryId: 3 })).resolves.toEqual({ year: 2025 });
    expect(yearReviewService.getReview).toHaveBeenCalledWith(7, 2025, 3);
  });

  it('reads the mood of the year on request', async () => {
    yearMoodService.generate.mockResolvedValue({ summary: 'Calm.' });

    await expect(controller.readMood(user as never, { year: 2025 })).resolves.toEqual({ mood: { summary: 'Calm.' } });
    expect(yearMoodService.generate).toHaveBeenCalledWith(7, 2025, undefined);
  });

  it('returns the week on the writer’s day and reflects on it on request', async () => {
    weeklyReflectionService.getWeek.mockResolvedValue({ entries: 3 });
    weeklyReflectionService.generate.mockResolvedValue({ question: 'What next?' });

    await expect(controller.getWeek(user as never, { today: '2026-11-21', diaryId: 2 })).resolves.toEqual({ entries: 3 });
    expect(weeklyReflectionService.getWeek).toHaveBeenCalledWith(7, '2026-11-21', 2);
    await expect(controller.reflectOnWeek(user as never, { today: '2026-11-21' })).resolves.toEqual({ reflection: { question: 'What next?' } });
    expect(weeklyReflectionService.generate).toHaveBeenCalledWith(7, '2026-11-21', undefined);
  });
});
