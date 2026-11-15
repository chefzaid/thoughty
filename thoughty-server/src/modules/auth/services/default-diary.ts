import type { Diary } from '@/database/entities';
import { getDefaultDiaryColor } from '@/common/utils';

/** The private "Thoughts" diary every new account starts with. */
export function defaultDiaryFor(userId: number): Partial<Diary> {
  return {
    userId,
    name: 'Thoughts',
    icon: '💭',
    color: getDefaultDiaryColor(0),
    isDefault: true,
    visibility: 'private',
  };
}
