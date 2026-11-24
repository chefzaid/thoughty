import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** The users repository is the second of the 19 the service takes first, the follows the seventh. */
function build(userRepository: ReturnType<typeof emptyRepository>, followRepository: ReturnType<typeof emptyRepository>) {
  const repositories = Array.from({ length: 19 }, emptyRepository);
  repositories[1] = userRepository;
  repositories[6] = followRepository;
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(...repositories, timeCapsules, ...Array.from({ length: 7 }, emptyRepository), createAccountActivityMock(), ...Array.from({ length: 6 }, emptyRepository));
}

describe('UserDataExportService followers by approval', () => {
  it('lists the switch, the writers followed and the requests still waiting apart', async () => {
    const users = emptyRepository();
    users.findOne.mockResolvedValue({ id: 1, username: 'me', email: 'me@example.com', followersByApproval: true });
    const follows = emptyRepository();
    follows.find.mockResolvedValue([
      { followedId: 2, status: 'approved', followed: { username: 'maya' }, createdAt: new Date('2024-02-01') },
      { followedId: 3, status: 'pending', followed: { username: 'omar' }, createdAt: new Date('2024-02-02') },
    ]);

    const data = await build(users, follows).downloadData(1);

    expect(data.user).toEqual(expect.objectContaining({ followersByApproval: true }));
    expect(data.following).toEqual([{ userId: 2, username: 'maya', followedAt: new Date('2024-02-01') }]);
    expect(data.followRequests).toEqual([{ userId: 3, username: 'omar', requestedAt: new Date('2024-02-02') }]);
  });
});
