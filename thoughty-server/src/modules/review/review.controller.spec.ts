import { ReviewController } from './review.controller';

describe('ReviewController', () => {
  const yearReviewService = { getReview: jest.fn() };
  const yearMoodService = { generate: jest.fn() };
  const controller = new ReviewController(yearReviewService as never, yearMoodService as never);
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
});
