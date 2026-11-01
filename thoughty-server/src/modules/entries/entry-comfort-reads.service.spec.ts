import { EntryComfortReadsService, GRATITUDE_TAGS } from './entry-comfort-reads.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryComfortReadsService', () => {
  let qb: ReturnType<typeof createQueryBuilder>;
  let service: EntryComfortReadsService;

  beforeEach(() => {
    qb = createQueryBuilder();
    qb.getRawMany!.mockResolvedValue([]);
    service = new EntryComfortReadsService({ createQueryBuilder: jest.fn(() => qb) } as never);
  });

  it("picks up to three of the writer's unsealed favorite or gratitude entries at random", async () => {
    qb.getRawMany!.mockResolvedValue([
      { id: '12', date: '2025-06-14', index: '2', title: 'The lake', content_start: '**We swam** before anyone was up.' },
      { id: 7, date: '2024-01-03', index: 1, title: null, content_start: null },
    ]);

    await expect(service.pick(4, {})).resolves.toEqual({
      entries: [
        { id: 12, date: '2025-06-14', index: 2, title: 'The lake', excerpt: 'We swam before anyone was up.' },
        { id: 7, date: '2024-01-03', index: 1, title: null, excerpt: '' },
      ],
    });

    expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(e.is_favorite = true OR EXISTS (SELECT 1 FROM unnest(e.tags) AS tag WHERE lower(tag) IN (:...gratitudeTags)))',
      { gratitudeTags: GRATITUDE_TAGS },
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith('e.id <> :excludeId', expect.anything());
    expect(qb.orderBy).toHaveBeenCalledWith('RANDOM()');
    expect(qb.limit).toHaveBeenCalledWith(3);
  });

  it('leaves out the entry just written', async () => {
    await expect(service.pick(4, { excludeId: 9 })).resolves.toEqual({ entries: [] });
    expect(qb.andWhere).toHaveBeenCalledWith('e.id <> :excludeId', { excludeId: 9 });
  });

  it('cuts a long text into a short excerpt at a word', async () => {
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    qb.getRawMany!.mockResolvedValue([{ id: 1, date: '2024-01-01', index: 1, title: null, content_start: words }]);

    const [entry] = (await service.pick(4, {})).entries;
    expect(entry!.excerpt.length).toBeLessThanOrEqual(141);
    expect(entry!.excerpt.endsWith('…')).toBe(true);
    expect(words.startsWith(entry!.excerpt.slice(0, -1))).toBe(true);
  });
});
