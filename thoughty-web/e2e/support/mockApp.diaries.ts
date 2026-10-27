import type { components } from '../../src/generated/openapi';

/** A diary exactly as the API serializes it, so the mock cannot drift from the contract. */
export type MockDiary = components['schemas']['DiaryResponseDto'];

/** A diary with the API's defaults for every field the caller leaves out. */
export function mockDiary(fields: Partial<MockDiary> & Pick<MockDiary, 'id' | 'name'>): MockDiary {
  return {
    userId: 1,
    icon: '📓',
    color: null,
    visibility: 'private',
    isDefault: false,
    position: fields.id - 1,
    goalType: null,
    goalTarget: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  };
}
