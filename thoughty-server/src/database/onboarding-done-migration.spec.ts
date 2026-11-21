import type { QueryRunner } from 'typeorm';
import { OnboardingDone1789084800000 } from './migrations/1789084800000-onboarding-done';

describe('OnboardingDone1789084800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('marks the onboarding done for every account that exists, keeping a value already stored', async () => {
    await new OnboardingDone1789084800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql(0)).toContain("SELECT id, 'onboardingDone', 'true' FROM users");
    expect(sql(0)).toContain('ON CONFLICT (user_id, key) DO NOTHING');
  });

  it('removes the setting again', async () => {
    await new OnboardingDone1789084800000().down(queryRunner);

    expect(sql(0)).toContain("DELETE FROM settings WHERE key = 'onboardingDone'");
  });
});
