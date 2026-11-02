import type { QueryRunner } from 'typeorm';
import { EntriesPerPageTwenty1787788800000 } from './migrations/1787788800000-entries-per-page-twenty';

describe('EntriesPerPageTwenty1787788800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('moves only a stored page size of 10, the old default, to 20', async () => {
    await new EntriesPerPageTwenty1787788800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith(
      "UPDATE settings SET value = '20' WHERE key = 'entriesPerPage' AND value = '10'",
    );
  });

  it('leaves the sizes as they are when rolled back', async () => {
    await new EntriesPerPageTwenty1787788800000().down();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
