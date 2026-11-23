import { ForbiddenException } from '@nestjs/common';
import { expectApiError } from '../errors/api-error.test-helpers';
import { AI_READABLE_WHERE, aiReadableEntrySql, assertDiaryAiAllowed, assertEntryAiAllowed } from './diary-ai';

describe('diary AI mode', () => {
  it('leaves entries of a diary with AI off out of queries and find options', () => {
    expect(aiReadableEntrySql()).toBe('NOT e.diary_ai_off');
    expect(aiReadableEntrySql('entry')).toBe('NOT entry.diary_ai_off');
    expect(AI_READABLE_WHERE).toEqual({ diaryAiOff: false });
  });

  it('refuses an AI action on an entry of a diary with AI off with 403 DIARY_AI_OFF', async () => {
    expect(() => assertEntryAiAllowed({ diaryAiOff: false })).not.toThrow();
    expect(() => assertEntryAiAllowed({})).not.toThrow();
    await expectApiError(
      Promise.resolve().then(() => assertEntryAiAllowed({ diaryAiOff: true })),
      ForbiddenException,
      'DIARY_AI_OFF',
    );
  });

  it('refuses an AI action on a diary with AI off, and lets one through without a diary', async () => {
    expect(() => assertDiaryAiAllowed({ aiMode: 'on' })).not.toThrow();
    expect(() => assertDiaryAiAllowed(null)).not.toThrow();
    expect(() => assertDiaryAiAllowed(undefined)).not.toThrow();
    await expectApiError(
      Promise.resolve().then(() => assertDiaryAiAllowed({ aiMode: 'off' })),
      ForbiddenException,
      'DIARY_AI_OFF',
    );
  });
});
