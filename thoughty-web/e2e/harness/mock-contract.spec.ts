import { test, expect } from '../support/test';
import { mockDiary } from '../support/mockApp.diaries';
import { checkMockResponse, checkQueryParameters } from '../support/mockApp.contract';
import { readQueryFlag } from '../support/mockApp.route-utils';

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

  test('refuses query flags and numbers the API refuses, as its @StrictBoolean() and @StrictInt() do', () => {
    const check = (query: string) => checkQueryParameters('GET', '/api/books/export', new URLSearchParams(query));

    expect(check('format=md&narrative=false&includeToc=0&embedImages=true&chapterFraming=1&diaryId=3')).toEqual([]);
    expect(check('narrative=yes')).toEqual(['GET /api/books/export sends narrative=yes, which the API refuses as a boolean']);
    expect(check('includeToc=true&includeToc=false')).toEqual([
      'GET /api/books/export sends includeToc=true&false, which the API refuses as a boolean',
    ]);
    expect(check('diaryId=')).toEqual(['GET /api/books/export sends diaryId=, which the API refuses as a number']);
    expect(check('diaryId=1.5&title=1.5')).toEqual(['GET /api/books/export sends diaryId=1.5, which the API refuses as a number']);
    expect(checkQueryParameters('GET', '/api/entries', new URLSearchParams('favorites=on'))).toEqual([
      'GET /api/entries sends favorites=on, which the API refuses as a boolean',
    ]);
  });

  test('reads a flag as the API does, with its default when it is not sent', () => {
    const params = new URLSearchParams('narrative=false&embedImages=1');

    expect(readQueryFlag(params, 'narrative', true)).toBe(false);
    expect(readQueryFlag(params, 'embedImages', false)).toBe(true);
    expect(readQueryFlag(params, 'includeToc', true)).toBe(true);
  });
});
