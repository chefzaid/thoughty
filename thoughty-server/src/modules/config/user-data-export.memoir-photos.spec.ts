import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download this spec does not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService memoir photo stories', () => {
  it('lists which entries tell the story of a photo, oldest first', async () => {
    const photoAnswers = emptyRepository();
    const answeredAt = new Date('2026-11-21T18:00:00Z');
    photoAnswers.find.mockResolvedValue([{ entryId: 81, userId: 1, createdAt: answeredAt }]);
    // Constructor order: 19 repositories, the time capsules service, seven more, the account activity, three more, then the photo stories
    const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
    const service = new Service(
      ...Array.from({ length: 19 }, emptyRepository),
      { reveal: jest.fn(async (rows: unknown[]) => rows) },
      ...Array.from({ length: 7 }, emptyRepository),
      createAccountActivityMock(),
      ...Array.from({ length: 3 }, emptyRepository),
      photoAnswers,
    );

    const data = await service.downloadData(1);

    expect(data.memoir).toEqual({ program: null, answers: [], photoAnswers: [{ entryId: 81, answeredAt }] });
    expect(photoAnswers.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC', entryId: 'ASC' } });
  });
});
