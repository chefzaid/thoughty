import type { Diary } from '../types';

/** A diary exactly as `GET /api/diaries` returns it, with the fields a test cares about overridden. */
export function makeDiary(overrides: Partial<Diary> & Pick<Diary, 'id' | 'name'>): Diary {
  return {
    userId: 1,
    icon: '📓',
    color: null,
    visibility: 'private',
    isDefault: false,
    position: overrides.id,
    goalType: null,
    goalTarget: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
