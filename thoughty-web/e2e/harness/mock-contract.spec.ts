import { test, expect } from '../support/test';
import { mockDiary } from '../support/mockApp.diaries';
import { checkMockResponse } from '../support/mockApp.contract';

// The guard every mock answer goes through: it must catch the drift that hid `is_default`.
test.describe('Mock API contract check', () => {
  test('accepts a diary list exactly as the API sends it', () => {
    expect(checkMockResponse('GET', '/api/diaries', 200, [mockDiary({ id: 1, name: 'Work', isDefault: true })])).toEqual([]);
  });

  test('flags a snake_case field the API never sends and the camelCase one it is missing', () => {
    const { isDefault: _isDefault, ...diary } = mockDiary({ id: 1, name: 'Work' });

    expect(checkMockResponse('GET', '/api/diaries', 200, [{ ...diary, is_default: true }])).toEqual([
      'GET /api/diaries 200 $[0].isDefault: missing',
      "GET /api/diaries 200 $[0].is_default: not in the API's response",
    ]);
  });

  test('flags wrong types, nulls and enum values, and picks the literal route over a parameter', () => {
    expect(checkMockResponse('PATCH', '/api/diaries/3/default', 200, mockDiary({ id: 3, name: 'Work', visibility: 'secret' as 'private' }))).toEqual([
      'PATCH /api/diaries/3/default 200 $.visibility: "secret" is not one of ["public","private"]',
    ]);
    expect(checkMockResponse('PATCH', '/api/diaries/reorder', 200, { success: 'yes' })).toEqual([
      'PATCH /api/diaries/reorder 200 $.success: expected boolean, got string',
    ]);
    expect(checkMockResponse('GET', '/api/diaries', 200, [{ ...mockDiary({ id: 1, name: 'Work' }), name: null }])).toEqual([
      'GET /api/diaries 200 $[0].name: is null but the API never sends null here',
    ]);
  });

  test('leaves alone answers the API documents no JSON body for', () => {
    expect(checkMockResponse('GET', '/api/config/feature-flags', 200, { anything: true })).toEqual([]);
    expect(checkMockResponse('GET', '/api/not-an-endpoint', 200, { anything: true })).toEqual([]);
    expect(checkMockResponse('GET', '/api/diaries', 401, { message: 'Unauthorized' })).toEqual([]);
  });
});
