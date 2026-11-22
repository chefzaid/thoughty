import type { QueryRunner } from 'typeorm';
import { PersonNotes1789516800000 } from './migrations/1789516800000-person-notes';

describe('PersonNotes1789516800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds optional notes on a person that are never blank', async () => {
    await new PersonNotes1789516800000().up(queryRunner);

    expect(sql()).toContain('ADD COLUMN notes TEXT');
    expect(sql()).toContain("chk_people_notes_not_blank CHECK (notes IS NULL OR btrim(notes) <> '')");
  });

  it('drops the check and the column', async () => {
    await new PersonNotes1789516800000().down(queryRunner);

    expect(sql()).toContain('DROP CONSTRAINT IF EXISTS chk_people_notes_not_blank');
    expect(sql()).toContain('DROP COLUMN IF EXISTS notes');
  });
});
