// Diary-related types, derived from the API contract so a renamed field fails the type check

import type { components } from '../generated/openapi';

/** A diary as `GET /api/diaries` returns it. */
export type Diary = components['schemas']['DiaryResponseDto'];

/** A writing goal: entries each Monday-to-Sunday week, or words each day. */
export type DiaryGoalType = NonNullable<Diary['goalType']>;

/** What the diary form sends to create a diary. */
export type DiaryFormData = components['schemas']['CreateDiaryDto'];

/** What the diary form sends to update a diary. */
export type DiaryUpdateData = components['schemas']['UpdateDiaryDto'];
