import { StatsTopWordsService } from './stats-top-words.service';

function createService(rows: Array<{ content: string | null }>) {
  const query = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  const repository = { createQueryBuilder: jest.fn(() => query) };
  return { service: new StatsTopWordsService(repository as never), query };
}

describe('StatsTopWordsService', () => {
  it('ranks the words of the diary’s entries from the first of the writer’s month to their day', async () => {
    const { service, query } = createService([
      { content: 'The garden after the rain. Garden again.' },
      { content: 'Le jardin sous la pluie, le jardin encore. Rain.' },
      { content: null },
    ]);

    await expect(service.analyze(7, 3, '2026-11-01')).resolves.toEqual({
      month: '2026-11',
      words: [
        { word: 'garden', count: 2 },
        { word: 'jardin', count: 2 },
        { word: 'rain', count: 2 },
      ],
    });
    expect(query.select).toHaveBeenCalledWith('e.content', 'content');
    expect(query.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
    expect(query.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(query.andWhere).toHaveBeenCalledWith('e.date BETWEEN :monthStart AND :today', { monthStart: '2026-11-01', today: '2026-11-01' });
    expect(query.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
  });

  it('reads every diary, lists at most ten words, and none without entries', async () => {
    const words = Array.from({ length: 12 }, (_, index) => `word${String.fromCodePoint(97 + index)}`);
    const { service, query } = createService([{ content: words.join(' ') }, { content: words.join(' ') }]);

    const result = await service.analyze(7, undefined, '2026-02-28');

    expect(result.month).toBe('2026-02');
    expect(result.words).toHaveLength(10);
    expect(result.words[0]).toEqual({ word: 'worda', count: 2 });
    expect(query.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
    await expect(createService([]).service.analyze(7, undefined, '2026-02-28')).resolves.toEqual({ month: '2026-02', words: [] });
  });
});
