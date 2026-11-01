import { EntryOpenTasksService, OPEN_TASKS_BATCH_SIZE } from './entry-open-tasks.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryOpenTasksService', () => {
  let qb: ReturnType<typeof createQueryBuilder>;
  let entryRepository: Record<string, jest.Mock>;
  let service: EntryOpenTasksService;

  const entry = (id: number, content: string, overrides: Record<string, unknown> = {}) =>
    ({ id, date: '2026-10-21', timeOfDay: null, index: 1, title: null, content, ...overrides });

  beforeEach(() => {
    qb = createQueryBuilder({ offset: jest.fn(() => qb) });
    entryRepository = { createQueryBuilder: jest.fn(() => qb) };
    service = new EntryOpenTasksService(entryRepository as never);
  });

  it("reads the writer's Markdown entries with an empty box, newest first, outside time capsules", async () => {
    qb.getMany.mockResolvedValue([]);

    await expect(service.list(4, {})).resolves.toEqual({ tasks: [], total: 0, page: 1, totalPages: 0, nextCursor: null });

    expect(qb.select).toHaveBeenCalledWith(['e.id', 'e.date', 'e.timeOfDay', 'e.index', 'e.title', 'e.content']);
    expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith("e.format = 'markdown'");
    expect(qb.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith("strpos(e.content, '[ ]') > 0");
    expect(qb.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
    expect(qb.orderBy).toHaveBeenCalledWith('e.date', 'DESC');
    expect(qb.addOrderBy.mock.calls).toEqual([['e.timeOfDay', 'ASC', 'NULLS FIRST'], ['e.index', 'ASC'], ['e.id', 'ASC']]);
    expect(qb.offset).toHaveBeenCalledWith(0);
    expect(qb.limit).toHaveBeenCalledWith(OPEN_TASKS_BATCH_SIZE);
  });

  it('lists only the unticked tasks, in entry order and top to bottom, and narrows to a diary', async () => {
    qb.getMany.mockResolvedValue([
      entry(9, '# Errands\n- [ ] Call the bank\n- [x] Post the letter\n```\n- [ ] in code\n```\n  * [ ] Nested', { title: 'Errands', date: '2026-10-22' }),
      entry(7, 'No task here [ ] at all'),
      entry(5, '1. [ ] Book the train'),
    ]);

    const result = await service.list(4, { diaryId: 3 });

    expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(result).toEqual({
      tasks: [
        { entryId: 9, date: '2026-10-22', title: 'Errands', line: 1, text: 'Call the bank' },
        { entryId: 9, date: '2026-10-22', title: 'Errands', line: 6, text: 'Nested' },
        { entryId: 5, date: '2026-10-21', title: null, line: 0, text: 'Book the train' },
      ],
      total: 3,
      page: 1,
      totalPages: 1,
      nextCursor: null,
    });
  });

  it('counts every task across batches and returns only the asked page', async () => {
    const full = Array.from({ length: OPEN_TASKS_BATCH_SIZE }, (_, index) => entry(1000 - index, `- [ ] Task ${index}`));
    qb.getMany.mockResolvedValueOnce(full).mockResolvedValueOnce([entry(1, '- [ ] Last one\n- [ ] Really last')]);

    const result = await service.list(4, { page: 3, limit: 99 });

    expect(qb.offset.mock.calls).toEqual([[0], [OPEN_TASKS_BATCH_SIZE]]);
    expect(result.total).toBe(OPEN_TASKS_BATCH_SIZE + 2);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(3);
    expect(result.tasks.map((task) => task.text)).toEqual(['Task 198', 'Task 199', 'Last one', 'Really last']);
  });

  it('hands the cursor of the last task on a page that has tasks after it', async () => {
    qb.getMany.mockResolvedValue([entry(9, '- [ ] One\n- [ ] Two', { index: 2, timeOfDay: '09:30' }), entry(5, '- [ ] Three')]);

    await expect(service.list(4, { limit: 2 })).resolves.toMatchObject({ total: 3, totalPages: 2, nextCursor: '2026-10-21_09:30_2_9_1' });
    await expect(service.list(4, { page: 2, limit: 2 })).resolves.toMatchObject({ page: 2, nextCursor: null });
    await expect(service.list(4, { page: 5, limit: 2 })).resolves.toMatchObject({ tasks: [], page: 5, nextCursor: null });
  });

  it('starts the next page after the cursor, so tasks ticked on the page before skip none', async () => {
    // Page 1 held One to Four (limit 4); One, Two and Four were ticked since, so an offset of 4 would skip Five to Seven
    qb.getMany.mockResolvedValue([
      entry(9, '- [x] One\n- [x] Two\n- [ ] Three', { date: '2026-10-22', index: 1 }),
      entry(8, '- [x] Four\n- [ ] Five\n- [ ] Six', { index: 1 }),
      entry(7, '- [ ] Seven\n- [ ] Eight\n- [ ] Nine\n- [ ] Ten', { index: 2 }),
    ]);
    const after = '2026-10-21__1_8_0';

    const next = await service.list(4, { after, limit: 4, page: 9 });

    expect(next.tasks.map((task) => task.text)).toEqual(['Five', 'Six', 'Seven', 'Eight']);
    expect(next).toMatchObject({ total: 7, page: 2, totalPages: 3, nextCursor: '2026-10-21__2_7_1' });
    await expect(service.list(4, { after: next.nextCursor!, limit: 4 })).resolves.toMatchObject({
      page: 3,
      totalPages: 3,
      nextCursor: null,
    });
  });

  it('counts the page from the tasks left before the cursor, and none past the end', async () => {
    qb.getMany.mockResolvedValue([entry(9, '- [ ] Left', { date: '2026-10-22' }), entry(8, '- [ ] Last')]);

    await expect(service.list(4, { after: '2026-10-23__1_1_0', limit: 1 })).resolves.toMatchObject({ page: 1, totalPages: 2 });
    await expect(service.list(4, { after: '2026-10-21__1_8_0', limit: 1 })).resolves.toMatchObject({
      tasks: [],
      total: 2,
      page: 3,
      totalPages: 2,
      nextCursor: null,
    });
  });
});
