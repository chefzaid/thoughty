import type { MigrationInterface, QueryRunner } from 'typeorm';

/** `diaries.name` is VARCHAR(100), counted in characters. */
const DIARY_NAME_MAX_LENGTH = 100;

interface DuplicateDiary {
  id: number;
  userId: number;
  name: string;
}

/**
 * One diary name per writer, ignoring case and surrounding spaces, as the app import already matches a
 * journal to "the diary of the same name". Diaries that already share a name keep the oldest one's name
 * intact (by `created_at`, then id); each later one is renamed `Name (2)`, `Name (3)`… with the first
 * number no diary of that writer uses yet. Nothing else about them changes. The table is locked against
 * writes meanwhile, so no duplicate can slip in before the index exists.
 */
export class DiaryUniqueNames1787011200000 implements MigrationInterface {
  name = 'DiaryUniqueNames1787011200000';

  /**
   * `Travel (2)` for the second diary named `Travel`, cutting the name (by characters, never inside an
   * emoji) so the number still fits in the column. A static method, as TypeORM would load any other
   * export of this file as a migration.
   */
  static numberedName(name: string, number: number): string {
    const suffix = `(${number})`;
    const characters = Array.from(name.trim());
    const room = DIARY_NAME_MAX_LENGTH - suffix.length - 1;
    const base = characters.length > room ? characters.slice(0, room).join('').trimEnd() : characters.join('');
    return base ? `${base} ${suffix}` : suffix;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE diaries IN SHARE ROW EXCLUSIVE MODE');
    const duplicates: DuplicateDiary[] = await queryRunner.query(`
      SELECT id, user_id AS "userId", name FROM (
        SELECT id, user_id, name, created_at,
               ROW_NUMBER() OVER (PARTITION BY user_id, lower(btrim(name)) ORDER BY created_at, id) AS rank
          FROM diaries
      ) ranked
       WHERE rank > 1
       ORDER BY user_id, created_at, id`);

    for (const duplicate of duplicates) {
      await queryRunner.query('UPDATE diaries SET name = $1 WHERE id = $2', [
        await this.freeName(queryRunner, duplicate),
        duplicate.id,
      ]);
    }

    await queryRunner.query('CREATE UNIQUE INDEX uq_diaries_user_name ON diaries (user_id, lower(btrim(name)))');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Renamed diaries keep their new names: nothing records which ones were renamed.
    await queryRunner.query('DROP INDEX IF EXISTS uq_diaries_user_name');
  }

  /** The first numbered name the writer has no diary called, compared as the index compares. */
  private async freeName(queryRunner: QueryRunner, { userId, name }: DuplicateDiary): Promise<string> {
    for (let number = 2; ; number += 1) {
      const candidate = DiaryUniqueNames1787011200000.numberedName(name, number);
      const [{ taken }] = await queryRunner.query(
        `SELECT EXISTS (
           SELECT 1 FROM diaries WHERE user_id = $1 AND lower(btrim(name)) = lower(btrim($2))
         ) AS taken`,
        [userId, candidate],
      );
      if (!taken) return candidate;
    }
  }
}
