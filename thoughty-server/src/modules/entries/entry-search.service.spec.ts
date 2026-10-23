import { EntrySearchService } from './entry-search.service';

describe('EntrySearchService', () => {
  let query: jest.Mock;
  let service: EntrySearchService;

  beforeEach(() => {
    query = jest.fn();
    service = new EntrySearchService({ query } as never);
  });

  it('builds the search in English and French and reads the last word as a prefix', async () => {
    query.mockResolvedValue([{ matchQuery: "'walk' & 'journ':*", matchNodes: 3, exactQuery: "'walk' & 'journ'", exactNodes: 3 }]);

    await expect(service.prepare(' walk journ ')).resolves.toEqual({
      kind: 'text',
      text: 'walk journ',
      matchQuery: "'walk' & 'journ':*",
      exactQuery: "'walk' & 'journ'",
      terms: [
        { text: 'walk', prefix: false },
        { text: 'journ', prefix: true },
      ],
    });

    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("websearch_to_tsquery('thoughty_en', $1) || websearch_to_tsquery('thoughty_fr', $1)");
    expect(sql).toContain("&& (to_tsquery('thoughty_en', $3) || to_tsquery('thoughty_fr', $3))");
    expect(params).toEqual(['walk journ', 'walk', 'journ:*']);
  });

  it('joins a prefix after OR as an alternative and skips the prefix for a phrase', async () => {
    query.mockResolvedValue([{ matchQuery: "'sea' | 'lak':*", matchNodes: 3, exactQuery: "'sea' | 'lak'", exactNodes: 3 }]);
    await service.prepare('sea or lak');
    expect(query.mock.calls[0][0]).toContain("|| (to_tsquery('thoughty_en', $3)");

    query.mockResolvedValue([{ matchQuery: "'sea' <-> 'lake'", matchNodes: 3, exactQuery: "'sea' <-> 'lake'", exactNodes: 3 }]);
    const prepared = await service.prepare('"sea lake"');
    expect(query.mock.calls[1][1]).toEqual(['"sea lake"']);
    expect(prepared).toEqual(expect.objectContaining({ kind: 'text', exactQuery: undefined }));
  });

  it('matches a search without words literally and ignores a blank one', async () => {
    query.mockResolvedValue([{ matchQuery: '', matchNodes: 0, exactQuery: '', exactNodes: 0 }]);

    await expect(service.prepare('🎉')).resolves.toEqual({ kind: 'literal', text: '🎉' });
    await expect(service.prepare('   ')).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns the distinct matches of each entry, longest first, for the owner only', async () => {
    query.mockResolvedValue([
      { id: 4, matches: ['run', 'Quick brown', 'quick brown', 'running'] },
      { id: 5, matches: null },
    ]);

    const matches = await service.findMatches(7, [4, 5, 6], [{ text: 'quick brown', prefix: false }, { text: 'run', prefix: true }]);

    expect(matches).toEqual(new Map([[4, ['quick brown', 'running', 'run']], [5, []]]));
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('e.user_id = $2 AND e.deleted_at IS NULL');
    expect(sql).toContain('ts_headline(terms.config, e.content, terms.query, $6)');
    expect(sql).toContain('to_tsvector(terms.config, run.text) @@ terms.query');
    expect(params.slice(0, 5)).toEqual([[4, 5, 6], 7, ['quick brown', 'run'], [false, true], ['thoughty_en', 'thoughty_fr']]);
  });

  it('skips the highlight query when there is nothing to highlight', async () => {
    await expect(service.findMatches(7, [], [{ text: 'walk', prefix: false }])).resolves.toEqual(new Map());
    await expect(service.findMatches(7, [1], [])).resolves.toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
  });
});
