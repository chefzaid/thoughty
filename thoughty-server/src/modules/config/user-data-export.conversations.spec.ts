import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { CONVERSATIONS_DOWNLOAD_SQL } from './user-data-export.helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** The follows repository is the seventh of the 19 the service takes first; it reads the conversations. */
function build(followRepository: ReturnType<typeof emptyRepository>) {
  const repositories = Array.from({ length: 19 }, emptyRepository);
  repositories[6] = followRepository;
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const Service = UserDataExportService as unknown as new (
    ...dependencies: unknown[]
  ) => UserDataExportService;
  return new Service(
    ...repositories,
    timeCapsules,
    ...Array.from({ length: 7 }, emptyRepository),
    createAccountActivityMock(),
    ...Array.from({ length: 6 }, emptyRepository),
  );
}

describe('UserDataExportService conversations', () => {
  it('writes each conversation with its writer and every message both ways, an empty one included', async () => {
    const follows = emptyRepository();
    const created = new Date('2026-11-20T08:00:00Z');
    follows.query.mockResolvedValue([
      {
        conversation_id: 7,
        conversation_created_at: created,
        writer_id: 2,
        username: 'maya',
        message_id: 30,
        sender_id: 1,
        body: 'Hello',
        created_at: new Date('2026-11-20T08:01:00Z'),
      },
      {
        conversation_id: 7,
        conversation_created_at: created,
        writer_id: 2,
        username: 'maya',
        message_id: 31,
        sender_id: 2,
        body: 'Hi!',
        created_at: new Date('2026-11-20T08:02:00Z'),
      },
      {
        conversation_id: 9,
        conversation_created_at: created,
        writer_id: 3,
        username: 'omar',
        message_id: null,
        sender_id: null,
        body: null,
        created_at: null,
      },
    ]);

    const data = await build(follows).downloadData(1);

    expect(follows.query).toHaveBeenCalledWith(CONVERSATIONS_DOWNLOAD_SQL, [1]);
    expect(data.conversations).toEqual([
      {
        id: 7,
        with: { userId: 2, username: 'maya' },
        createdAt: created,
        messages: [
          { id: 30, sentByMe: true, body: 'Hello', sentAt: new Date('2026-11-20T08:01:00Z') },
          { id: 31, sentByMe: false, body: 'Hi!', sentAt: new Date('2026-11-20T08:02:00Z') },
        ],
      },
      { id: 9, with: { userId: 3, username: 'omar' }, createdAt: created, messages: [] },
    ]);
  });
});
