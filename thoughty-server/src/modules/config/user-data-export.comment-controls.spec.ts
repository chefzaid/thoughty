import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download these specs do not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

/** Constructor order: 19 repositories (entries 4th, comments 8th), the time capsules service, then 5 more. */
function build(entries: ReturnType<typeof emptyRepository>, comments: ReturnType<typeof emptyRepository>) {
  const timeCapsules = { reveal: jest.fn(async (rows: unknown[]) => rows) };
  const repositories = Array.from({ length: 19 }, emptyRepository);
  repositories[3] = entries;
  repositories[7] = comments;
  const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
  return new Service(...repositories, timeCapsules, ...Array.from({ length: 7 }, emptyRepository));
}

describe('UserDataExportService comment controls', () => {
  it('keeps who may comment on each entry, and which of the writer’s comments were hidden', async () => {
    const entries = emptyRepository();
    entries.find.mockResolvedValue([
      { id: 1, content: 'Out loud', tags: [], commentPolicy: 'followers' },
      { id: 2, content: 'Following the default', tags: [], commentPolicy: null },
    ]);
    const comments = emptyRepository();
    comments.find.mockResolvedValue([
      { id: 9, entryId: 40, content: 'Lovely', createdAt: new Date('2024-03-01'), hiddenAt: null },
      { id: 10, entryId: 41, content: 'Sharp', createdAt: new Date('2024-03-02'), hiddenAt: new Date('2024-03-04') },
    ]);

    const data = await build(entries, comments).downloadData(1);

    expect(data.entries).toEqual([
      expect.objectContaining({ id: 1, commentPolicy: 'followers' }),
      expect.objectContaining({ id: 2, commentPolicy: null }),
    ]);
    expect(data.comments).toEqual([
      { id: 9, entryId: 40, content: 'Lovely', createdAt: new Date('2024-03-01'), hiddenAt: null },
      { id: 10, entryId: 41, content: 'Sharp', createdAt: new Date('2024-03-02'), hiddenAt: new Date('2024-03-04') },
    ]);
  });
});
