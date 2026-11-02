import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The journal shows 20 entries a page by default instead of 10. The profile saves every preference
 * together, so a stored 10 cannot be told apart from the old default: it moves to the new one. Any
 * other page size was picked on purpose and stays.
 */
export class EntriesPerPageTwenty1787788800000 implements MigrationInterface {
  name = 'EntriesPerPageTwenty1787788800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE settings SET value = '20' WHERE key = 'entriesPerPage' AND value = '10'`);
  }

  async down(): Promise<void> {
    // The moved sizes stay at 20: nothing records which rows held the old default.
  }
}
