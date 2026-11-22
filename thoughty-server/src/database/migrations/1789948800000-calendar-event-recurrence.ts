import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repeating calendar events: an imported event keeps how it repeats (its rule, last occurrence, extra
 * and removed occurrences) beside its first occurrence, so the composer lists it on every day it falls
 * on. Null for a one-off event, as every event imported before.
 */
export class CalendarEventRecurrence1789948800000 implements MigrationInterface {
  name = 'CalendarEventRecurrence1789948800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence JSONB;');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE calendar_events DROP COLUMN IF EXISTS recurrence;');
  }
}
