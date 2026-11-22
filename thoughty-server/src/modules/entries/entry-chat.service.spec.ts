import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MAX_ENTRIES_CHAT_ENTRIES, MAX_ENTRIES_CHAT_ENTRY_LENGTH } from '@/modules/ai';
import { EntryChatService } from './entry-chat.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntryChatService', () => {
  let qb: ReturnType<typeof createQueryBuilder>;
  let entrySearch: { prepare: jest.Mock };
  let aiEntriesChat: { reply: jest.Mock };
  let service: EntryChatService;
  const messages = [{ role: 'user' as const, content: 'What comes back?' }];

  beforeEach(() => {
    qb = createQueryBuilder();
    // Newest first, as the query orders them
    qb.getRawMany!.mockResolvedValue([
      { id: '9', date: '2026-03-08', title: null, content: '**Rain** all day.\n\nStayed in.', total: '7' },
      { id: '4', date: '2026-03-01', title: 'Spring', content: 'First tulips.', total: '7' },
    ]);
    entrySearch = { prepare: jest.fn() };
    aiEntriesChat = { reply: jest.fn().mockResolvedValue('Spring opens it [1], then rain [2][9].') };
    const entryRepository = { createQueryBuilder: jest.fn(() => qb) };
    service = new EntryChatService(entryRepository as never, entrySearch as never, aiEntriesChat as never);
  });

  it("reads the writer's newest unsealed matches oldest first, and says which ones the reply cites", async () => {
    await expect(service.chat(4, { tags: 'walks' }, { messages })).resolves.toEqual({
      reply: 'Spring opens it [1], then rain [2][9].',
      entries: [
        { ref: 1, id: 4, date: '2026-03-01', title: 'Spring' },
        { ref: 2, id: 9, date: '2026-03-08', title: null },
      ],
      cited: [1, 2],
      total: 7,
    });

    expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('e.tags @> :tagList', { tagList: ['walks'] });
    expect(qb.orderBy).toHaveBeenCalledWith('e.date', 'DESC');
    expect(qb.limit).toHaveBeenCalledWith(MAX_ENTRIES_CHAT_ENTRIES);
    expect(aiEntriesChat.reply).toHaveBeenCalledWith(4, [
      { date: '2026-03-01', title: 'Spring', text: 'First tulips.' },
      { date: '2026-03-08', title: null, text: 'Rain all day. Stayed in.' },
    ], messages);
    expect(entrySearch.prepare).not.toHaveBeenCalled();
  });

  it("narrows to the list's day, a date range and the word search", async () => {
    entrySearch.prepare.mockResolvedValue({ kind: 'text', text: 'harbor', matchQuery: "'harbor':*", terms: [] });

    await service.chat(4, { search: 'harbor', date: '2026-03-01', dateFrom: '2026-01-01', dateTo: '2026-06-30' }, { messages });

    expect(entrySearch.prepare).toHaveBeenCalledWith('harbor');
    expect(qb.andWhere).toHaveBeenCalledWith('e.date = :date', { date: '2026-03-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.date >= :dateFrom', { dateFrom: '2026-01-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.date <= :dateTo', { dateTo: '2026-06-30' });
  });

  it('cuts long entries and stops at the length the entries may take together, keeping the newest', async () => {
    const long = 'word '.repeat(1000);
    qb.getRawMany!.mockResolvedValue(Array.from({ length: 40 }, (_, index) => ({
      id: String(100 - index), date: `2026-02-${String(28 - (index % 28)).padStart(2, '0')}`, title: null, content: long, total: '40',
    })));

    const { entries } = await service.chat(4, {}, { messages });

    const sent = aiEntriesChat.reply.mock.calls[0][1] as Array<{ text: string }>;
    expect(sent[0].text).toHaveLength(MAX_ENTRIES_CHAT_ENTRY_LENGTH);
    expect(sent[0].text.endsWith('…')).toBe(true);
    expect(entries).toHaveLength(26);
    expect(entries.at(-1)).toMatchObject({ ref: 26, id: 100 });
  });

  it('reads the newest entry even when it alone is longer than the budget allows', async () => {
    qb.getRawMany!.mockResolvedValue([{ id: '3', date: '2026-01-01', title: 'Only', content: 'x'.repeat(50_000), total: '1' }]);

    await expect(service.chat(4, {}, { messages })).resolves.toMatchObject({ entries: [{ ref: 1, id: 3 }], total: 1 });
  });

  it('answers 404 with a code when no entry matches, without asking the AI', async () => {
    qb.getRawMany!.mockResolvedValue([]);

    await expectApiError(service.chat(4, { mood: '1' }, { messages }), NotFoundException, 'ENTRY_CHAT_NO_MATCH');
    expect(aiEntriesChat.reply).not.toHaveBeenCalled();
  });
});
