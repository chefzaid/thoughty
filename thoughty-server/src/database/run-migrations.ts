import { MigrationExecutor, type DataSource, type Migration } from 'typeorm';

/**
 * Applies every pending migration in one transaction, as `runMigrations({ transaction: 'all' })`
 * does, with deferrable constraint triggers set to fire at the end of each statement. The journal
 * list version triggers are deferred to the commit, and PostgreSQL refuses to alter or index a table
 * whose changed rows still have trigger events queued, so a migration that fills rows and then
 * alters their table (a backfill before `SET NOT NULL`) would otherwise fail on any database with
 * data in it.
 */
export async function runPendingMigrations(dataSource: DataSource): Promise<Migration[]> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query('SET CONSTRAINTS ALL IMMEDIATE');
    const applied = await new MigrationExecutor(dataSource, queryRunner).executePendingMigrations();
    await queryRunner.commitTransaction();
    return applied;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
