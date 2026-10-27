import type { ContractUser } from './contract-client';
import type { ContractContext } from './contract-suite';

/** A day as the web sends it (`formatEntryDate`): the local `YYYY-MM-DD`. */
export function todayIso(offsetDays = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`;
}

export interface EntryDraft {
  text: string;
  tags?: string[];
  date?: string;
  visibility?: 'public' | 'private';
  format?: 'plain' | 'markdown';
  diaryId?: number;
  title?: string;
  mood?: number;
}

/** Writes an entry the way the composer does (`entriesService.createEntry`) and returns its id. */
export async function createEntry(
  context: ContractContext,
  user: ContractUser,
  draft: EntryDraft,
): Promise<number> {
  const response = await context.client.call('POST /api/entries', {
    as: user,
    json: {
      text: draft.text,
      ...(draft.title ? { title: draft.title } : {}),
      ...(draft.mood ? { mood: draft.mood } : {}),
      tags: draft.tags ?? [],
      date: draft.date ?? todayIso(),
      visibility: draft.visibility ?? 'private',
      format: draft.format ?? 'plain',
      ...(draft.diaryId ? { diaryId: draft.diaryId } : {}),
    },
    status: 201,
  });
  return (response.body as { entryId: number }).entryId;
}

/** The writer's default diary, read from `GET /api/diaries` as the diary tabs do. */
export async function defaultDiaryId(
  context: ContractContext,
  user: ContractUser,
): Promise<number> {
  const response = await context.client.call('GET /api/diaries', { as: user, status: 200 });
  const diaries = response.body as { id: number; isDefault: boolean }[];
  const diary = diaries.find((candidate) => candidate.isDefault);
  if (!diary) throw new Error(`${user.username} has no default diary`);
  return diary.id;
}

/** A 1x1 PNG, the smallest real image an upload accepts. */
export const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
