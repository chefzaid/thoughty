import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { EntryRandomService } from './entry-random.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryRandomService', () => {
  let picked: ReturnType<typeof createQueryBuilder>;
  let entrySearch: { prepare: jest.Mock };
  let service: EntryRandomService;

  beforeEach(() => {
    picked = createQueryBuilder({ setParameter: jest.fn(() => picked) });
    picked.getRawOne!.mockResolvedValue({ id: '12', date: '2024-03-10', index: 2 });
    entrySearch = { prepare: jest.fn() };
    const entryRepository = { createQueryBuilder: jest.fn(() => picked) };
    service = new EntryRandomService(entryRepository as never, entrySearch as never);
  });

  it("picks one of the writer's unsealed matches at random", async () => {
    await expect(service.pick(4, { tags: 'walks' })).resolves.toEqual({ id: 12, date: '2024-03-10', index: 2 });

    expect(picked.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(picked.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(picked.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['walks'] });
    expect(picked.orderBy).toHaveBeenCalledWith('RANDOM()');
    expect(picked.limit).toHaveBeenCalledWith(1);
    expect(entrySearch.prepare).not.toHaveBeenCalled();
  });

  it('keeps the entry picked last time for when nothing else matches', async () => {
    await service.pick(4, { excludeId: 7 });

    expect(picked.orderBy).toHaveBeenCalledWith('e.id = :excludeId', 'ASC');
    expect(picked.setParameter).toHaveBeenCalledWith('excludeId', 7);
    expect(picked.addOrderBy).toHaveBeenCalledWith('RANDOM()');
  });

  it('narrows to the date filter and the word search', async () => {
    entrySearch.prepare.mockResolvedValue({ kind: 'text', text: 'harbor', matchQuery: "'harbor':*", terms: [] });

    await service.pick(4, { search: 'harbor', date: '2024-03-10' });

    expect(entrySearch.prepare).toHaveBeenCalledWith('harbor');
    expect(picked.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2024-03-10' });
    expect(picked.andWhere).toHaveBeenCalledWith(
      '(e.search_vector @@ CAST(:searchQuery AS tsquery) OR e.tags @> :searchTags)',
      { searchQuery: "'harbor':*", searchTags: ['harbor'] },
    );
  });

  it('answers 404 with a code when no entry matches', async () => {
    picked.getRawOne!.mockResolvedValue(undefined);

    await expectApiError(service.pick(4, { mood: '1' }), NotFoundException, 'ENTRY_RANDOM_NO_MATCH');
  });
});
