import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The journal scrolls on and loads the next entries as the list nears its end, so it has no page size
 * any more and `entriesPerPage` stops being a setting: the stored sizes are removed. Rolling back leaves
 * them out, and the old default (20) applies to everyone again.
 */
export class RemoveEntriesPerPage1788220800000 implements MigrationInterface {
  name = 'RemoveEntriesPerPage1788220800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM settings WHERE key = 'entriesPerPage'`);
  }

  async down(): Promise<void> {
    // The removed sizes are not kept anywhere: the default page size applies once more.
  }
}
