import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The language and theme a visitor read the pages in when signing up, kept with the sign-up until its
 * emailed link creates the account, which then starts with them as its `language` and `theme` settings.
 * Empty for the requests made before (and for an address that already has an account): the account
 * defaults apply.
 */
export class SignUpRequestPreferences1790467200000 implements MigrationInterface {
  name = 'SignUpRequestPreferences1790467200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sign_up_requests ADD COLUMN language VARCHAR(2);
      ALTER TABLE sign_up_requests ADD COLUMN theme VARCHAR(5);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sign_up_requests DROP COLUMN IF EXISTS theme;
      ALTER TABLE sign_up_requests DROP COLUMN IF EXISTS language;
    `);
  }
}
