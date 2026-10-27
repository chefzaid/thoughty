import { Entry } from '@/database/entities';
import { EntryMentionsService } from './entry-mentions.service';

describe('EntryMentionsService', () => {
  let manager: { getRepository: jest.Mock; query: jest.Mock };
  let save: jest.Mock;
  let service: EntryMentionsService;

  beforeEach(() => {
    save = jest.fn(async (value) => (Array.isArray(value)
      ? value.map((entry, index) => ({ id: index + 1, ...entry }))
      : { id: 5, ...value }));
    manager = { getRepository: jest.fn(() => ({ save })), query: jest.fn().mockResolvedValue([]) };
    const repository = { manager: { transaction: jest.fn((work) => work(manager)) } };
    service = new EntryMentionsService(repository as never);
  });

  it('saves an entry and relinks it to the people it mentions in the same transaction', async () => {
    await expect(service.save(7, { userId: 7, content: 'No one today' })).resolves.toEqual({ id: 5, userId: 7, content: 'No one today' });

    expect(manager.getRepository).toHaveBeenCalledWith(Entry);
    expect(manager.query).toHaveBeenCalledWith('DELETE FROM entry_people WHERE entry_id = ANY($1::int[])', [[5]]);
  });

  it('saves several entries at once', async () => {
    const saved = await service.save(7, [{ content: 'One' }, { content: 'Two' }]);

    expect(saved.map((entry) => entry.id)).toEqual([1, 2]);
    expect(manager.query).toHaveBeenCalledWith('DELETE FROM entry_people WHERE entry_id = ANY($1::int[])', [[1, 2]]);
  });
});
