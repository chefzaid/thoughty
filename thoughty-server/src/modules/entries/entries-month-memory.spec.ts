import { EntriesQueryService } from './entries-query.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntriesQueryService.findMonthMemory', () => {
  const setup = (rows: { entities: unknown[]; raw: unknown[] }) => {
    const qb = createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue(rows) });
    const repository = { createQueryBuilder: jest.fn(() => qb) };
    return { qb, service: new EntriesQueryService(repository as never, {} as never, {} as never) };
  };

  it('picks a favorite first, then the longest and oldest entry of that month in an earlier year', async () => {
    const entry = { id: 5, date: '2019-10-12' };
    const { qb, service } = setup({ entities: [entry], raw: [{ entry_year: '2019' }] });

    await expect(service.findMonthMemory(3, { year: 2026, month: 10, diaryId: 4 })).resolves.toEqual({ entry, yearsAgo: 7 });

    expect(qb.andWhere).toHaveBeenCalledWith('EXTRACT(MONTH FROM e.date) = :month', { month: 10 });
    expect(qb.andWhere).toHaveBeenCalledWith('EXTRACT(YEAR FROM e.date) < :year', { year: 2026 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.is_archived = FALSE');
    expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 4 });
    expect(qb.orderBy).toHaveBeenCalledWith('e.is_favorite', 'DESC');
    expect(qb.addOrderBy.mock.calls).toEqual([['entry_words', 'DESC'], ['e.date', 'ASC'], ['e.id', 'ASC']]);
    expect(qb.limit).toHaveBeenCalledWith(1);
  });

  it('answers null without one, reading every diary when none is chosen', async () => {
    const { qb, service } = setup({ entities: [], raw: [] });

    await expect(service.findMonthMemory(3, { year: 2026, month: 1, diaryId: null })).resolves.toBeNull();
    expect(qb.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
  });
});
