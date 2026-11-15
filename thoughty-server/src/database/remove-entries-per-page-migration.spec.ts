import type { QueryRunner } from 'typeorm';
import { RemoveEntriesPerPage1788220800000 } from './migrations/1788220800000-remove-entries-per-page';

describe('RemoveEntriesPerPage1788220800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('removes every stored page size, and nothing else', async () => {
    await new RemoveEntriesPerPage1788220800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith("DELETE FROM settings WHERE key = 'entriesPerPage'");
  });

  it('brings nothing back when rolled back', async () => {
    await new RemoveEntriesPerPage1788220800000().down();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
