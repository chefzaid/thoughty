import { MigrationExecutor, type DataSource } from 'typeorm';
import { runPendingMigrations } from './run-migrations';

describe('runPendingMigrations', () => {
  const queryRunner = {
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: () => queryRunner,
    driver: { options: {}, database: 'journal', buildTableName: (name: string) => name },
    options: {},
  } as unknown as DataSource;
  const execute = jest.spyOn(MigrationExecutor.prototype, 'executePendingMigrations');

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => execute.mockRestore());

  it('runs the pending migrations in its own transaction, with deferrable triggers firing per statement', async () => {
    const applied = [{ name: 'Later1' }];
    execute.mockImplementation(async function (this: MigrationExecutor) {
      expect(queryRunner.query).toHaveBeenCalledWith('SET CONSTRAINTS ALL IMMEDIATE');
      expect(this.transaction).toBe('all');
      return applied as never;
    });

    await expect(runPendingMigrations(dataSource)).resolves.toBe(applied);

    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('rolls everything back when a migration fails', async () => {
    execute.mockRejectedValue(new Error('broken migration'));

    await expect(runPendingMigrations(dataSource)).rejects.toThrow('broken migration');

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
