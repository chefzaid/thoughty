import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First-run onboarding: an account without `onboardingDone` is asked what it is here for when it signs
 * in. Every account that exists already has been using the app, so it is marked as done and never sees
 * the welcome page; only accounts created from now on start without the setting.
 */
export class OnboardingDone1789084800000 implements MigrationInterface {
  name = 'OnboardingDone1789084800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO settings (user_id, key, value)
      SELECT id, 'onboardingDone', 'true' FROM users
      ON CONFLICT (user_id, key) DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM settings WHERE key = 'onboardingDone';`);
  }
}
