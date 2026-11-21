import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** Constructor order: 19 repositories, the time capsules service, seven more repositories, then the account activity. */
function build(activity: ReturnType<typeof createAccountActivityMock>) {
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(
    ...Array.from({ length: 19 }, emptyRepository),
    timeCapsules,
    ...Array.from({ length: 7 }, emptyRepository),
    activity,
  );
}

describe('UserDataExportService account activity', () => {
  it('includes the past year’s events without their ids, and the new-browser email setting', async () => {
    const activity = createAccountActivityMock();
    const createdAt = new Date('2026-11-20T08:00:00Z');
    activity.listForDownload.mockResolvedValue([
      { id: 4, kind: 'sign_in', browser: 'Firefox', system: 'Linux', createdAt },
      { id: 5, kind: 'pin_set', browser: null, system: null, createdAt },
    ]);
    activity.newBrowserEmailEnabled.mockResolvedValue(false);

    const data = await build(activity).downloadData(1);

    expect(data.accountActivity).toEqual({
      newBrowserEmail: false,
      events: [
        { kind: 'sign_in', browser: 'Firefox', system: 'Linux', createdAt },
        { kind: 'pin_set', browser: null, system: null, createdAt },
      ],
    });
    expect(activity.listForDownload).toHaveBeenCalledWith(1);
    expect(activity.newBrowserEmailEnabled).toHaveBeenCalledWith(1);
  });
});
