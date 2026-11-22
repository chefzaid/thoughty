import type { ComponentProps } from 'react';
import DiaryManager from '../components/DiaryManager/DiaryManager';
import { useDiaryWritingReminders } from '../components/DiaryManager/useDiaryWritingReminders';

type DiariesRouteProps = Omit<ComponentProps<typeof DiaryManager>, 'writingReminders' | 'onSaveWritingReminder'>;

/** Manage Diaries, with each diary's own writing reminder hour. */
function DiariesRoute(props: Readonly<DiariesRouteProps>) {
  const { reminders, save } = useDiaryWritingReminders();
  return <DiaryManager {...props} writingReminders={reminders} onSaveWritingReminder={save} />;
}

export default DiariesRoute;
