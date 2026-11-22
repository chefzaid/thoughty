import type { components } from '../../src/generated/openapi';
import { fulfillApiError, fulfillJson, isTimeZone, type RouteContext } from './mockApp.route-utils';
import { nextSendAt } from './mockApp.routes.opt-in-emails';
import type { MockAppState } from './mockApp.shared';

export type MockDiaryWritingReminder = components['schemas']['DiaryWritingReminderDto'];
type DiaryWritingReminderChanges = components['schemas']['UpdateDiaryWritingReminderDto'];

const DIARY_REMINDER_PATH = /^\/api\/writing-reminder-email\/diaries\/(\d+)$/;

/** The diaries' own reminders move to the account reminder's new zone, each at its own hour, as the API moves them. */
export function followTimeZone(state: MockAppState, timeZone: string) {
  state.diaryWritingReminders = state.diaryWritingReminders.map((reminder) =>
    reminder.timeZone === timeZone ? reminder : { ...reminder, timeZone, nextSendAt: nextSendAt(reminder.deliveryHour, timeZone, false) },
  );
}

function answer(state: MockAppState) {
  return {
    reminders: [...state.diaryWritingReminders].sort((left, right) => left.diaryId - right.diaryId),
    emailAvailable: state.writingReminderEmail.emailAvailable,
  };
}

/**
 * The diaries' own writing reminder hours as the API answers them: `GET /api/writing-reminder-email/diaries`
 * and `PUT /api/writing-reminder-email/diaries/{diaryId}`, which keeps the account reminder's zone once it is saved.
 */
export async function handleDiaryReminderRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/writing-reminder-email/diaries' && request.method() === 'GET') {
    await fulfillJson(route, answer(state));
    return true;
  }

  const match = DIARY_REMINDER_PATH.exec(pathname);
  if (!match || request.method() !== 'PUT') return false;

  const diaryId = Number(match[1]);
  const changes = request.postDataJSON() as DiaryWritingReminderChanges;
  if (!isTimeZone(changes.timeZone)) {
    await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'Unknown time zone');
    return true;
  }
  if (!state.diaries.some((diary) => diary.id === diaryId)) {
    await fulfillApiError(route, 404, 'DIARY_NOT_FOUND', 'Diary not found');
    return true;
  }

  const others = state.diaryWritingReminders.filter((reminder) => reminder.diaryId !== diaryId);
  if (changes.deliveryHour === null) {
    state.diaryWritingReminders = others;
  } else {
    const timeZone = state.writingReminderEmail.timeZone ?? changes.timeZone;
    state.diaryWritingReminders = [
      ...others,
      { diaryId, deliveryHour: changes.deliveryHour, timeZone, nextSendAt: nextSendAt(changes.deliveryHour, timeZone, false) },
    ];
  }
  await fulfillJson(route, answer(state));
  return true;
}
