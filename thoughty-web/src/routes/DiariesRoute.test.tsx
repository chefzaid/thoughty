import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DiariesRoute from './DiariesRoute';

const save = vi.fn();
vi.mock('../components/DiaryManager/useDiaryWritingReminders', () => ({
  useDiaryWritingReminders: () => ({ reminders: { hours: { 2: 7 }, emailAvailable: true }, save }),
}));
vi.mock('../components/DiaryManager/DiaryManager', () => ({
  default: ({ writingReminders, onSaveWritingReminder }: { writingReminders?: { hours: Record<number, number> }; onSaveWritingReminder?: unknown }) => (
    <p>{`Manage Diaries ${JSON.stringify(writingReminders?.hours)} ${onSaveWritingReminder === save}`}</p>
  ),
}));

describe('DiariesRoute', () => {
  it('shows Manage Diaries with the diaries’ own writing reminder hours and their save', () => {
    render(
      <DiariesRoute
        diaries={[]}
        onCreateDiary={vi.fn()}
        onUpdateDiary={vi.fn()}
        onDeleteDiary={vi.fn()}
        onSetDefault={vi.fn()}
        onReorderDiaries={vi.fn()}
        onBack={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(screen.getByText('Manage Diaries {"2":7} true')).toBeInTheDocument();
  });
});
