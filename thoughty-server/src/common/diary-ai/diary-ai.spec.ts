import { ForbiddenException } from '@nestjs/common';
import { expectApiError } from '../errors/api-error.test-helpers';
import { AI_READABLE_WHERE, aiReadableEntrySql, assertDiaryAiAllowed, assertEntryAiAllowed } from './diary-ai';

describe('diary AI mode', () => {
  it('leaves entries of a diary with AI off or set to ask out of journal-wide queries and find options', () => {
    expect(aiReadableEntrySql()).toBe('(NOT e.diary_ai_off AND NOT e.diary_ai_ask)');
    expect(aiReadableEntrySql('entry')).toBe('(NOT entry.diary_ai_off AND NOT entry.diary_ai_ask)');
    expect(AI_READABLE_WHERE).toEqual({ diaryAiOff: false, diaryAiAsk: false });
  });

  it('refuses an AI action on an entry of a diary with AI off with 403 DIARY_AI_OFF, consent or not', async () => {
    expect(() => assertEntryAiAllowed({ diaryAiOff: false })).not.toThrow();
    expect(() => assertEntryAiAllowed({})).not.toThrow();
    await expectApiError(
      Promise.resolve().then(() => assertEntryAiAllowed({ diaryAiOff: true })),
      ForbiddenException,
      'DIARY_AI_OFF',
    );
    await expectApiError(
      Promise.resolve().then(() => assertEntryAiAllowed({ diaryAiOff: true }, true)),
      ForbiddenException,
      'DIARY_AI_OFF',
    );
  });

  it('lets an AI action on an entry of a diary that asks each time through only with consent', async () => {
    expect(() => assertEntryAiAllowed({ diaryAiAsk: true }, true)).not.toThrow();
    for (const consent of [undefined, false]) {
      await expectApiError(
        Promise.resolve().then(() => assertEntryAiAllowed({ diaryAiAsk: true }, consent)),
        ForbiddenException,
        'DIARY_AI_CONSENT_REQUIRED',
      );
    }
  });

  it('refuses an AI action on a diary with AI off, asks consent for one set to ask, and lets one through without a diary', async () => {
    expect(() => assertDiaryAiAllowed({ aiMode: 'on' })).not.toThrow();
    expect(() => assertDiaryAiAllowed({ aiMode: 'ask' }, true)).not.toThrow();
    expect(() => assertDiaryAiAllowed(null)).not.toThrow();
    expect(() => assertDiaryAiAllowed(undefined)).not.toThrow();
    await expectApiError(
      Promise.resolve().then(() => assertDiaryAiAllowed({ aiMode: 'off' }, true)),
      ForbiddenException,
      'DIARY_AI_OFF',
    );
    await expectApiError(
      Promise.resolve().then(() => assertDiaryAiAllowed({ aiMode: 'ask' })),
      ForbiddenException,
      'DIARY_AI_CONSENT_REQUIRED',
    );
  });
});
