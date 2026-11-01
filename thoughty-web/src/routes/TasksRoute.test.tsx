import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import TasksRoute from './TasksRoute';

vi.mock('../components/OpenTasks/OpenTasksPage', () => ({
  default: ({ page, after, diaryId, onChangePage }: {
    page: number;
    after: string | null;
    diaryId: number | null;
    onChangePage: (page: number, options?: { replace?: boolean; after?: string }) => void;
  }) => (
    <>
      <p>{`page ${page} of diary ${diaryId ?? 'all'}${after ? ` after ${after}` : ''}`}</p>
      <button type="button" onClick={() => onChangePage(3)}>page 3</button>
      <button type="button" onClick={() => onChangePage(2, { after: '2026-10-21__1_42_3' })}>next page</button>
      <button type="button" onClick={() => onChangePage(1, { replace: true })}>first page</button>
    </>
  ),
}));

vi.mock('../components/DiaryTabs/DiaryTabs', () => ({
  default: ({ onDiaryChange }: { onDiaryChange: (diaryId: number | null) => void }) => (
    <button type="button" onClick={() => onDiaryChange(5)}>diary 5</button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderAt(initialEntry: string, onDiaryChange = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={(
            <>
              <TasksRoute t={(key) => key} diaries={[]} currentDiaryId={2} onDiaryChange={onDiaryChange} onManageDiaries={vi.fn()} />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
  return { onDiaryChange };
}

describe('TasksRoute', () => {
  it('shows the current diary’s tasks on the page from the address', () => {
    renderAt('/tasks?diary=2&page=2');
    expect(screen.getByText('page 2 of diary 2')).toBeInTheDocument();
  });

  it.each(['/tasks', '/tasks?page=abc', '/tasks?page=-1'])('opens %s on the first page', (path) => {
    renderAt(path);
    expect(screen.getByText('page 1 of diary 2')).toBeInTheDocument();
  });

  it('keeps the page in the address beside the diary, and hands diary changes on', () => {
    const { onDiaryChange } = renderAt('/tasks?diary=2');

    fireEvent.click(screen.getByRole('button', { name: 'page 3' }));
    expect(screen.getByRole('status')).toHaveTextContent('/tasks?diary=2&page=3');
    fireEvent.click(screen.getByRole('button', { name: 'first page' }));
    expect(screen.getByRole('status')).toHaveTextContent('/tasks?diary=2');
    fireEvent.click(screen.getByRole('button', { name: 'diary 5' }));
    expect(onDiaryChange).toHaveBeenCalledWith(5);
  });

  it('keeps the cursor of a page reached with Next in its history entry, not the address', () => {
    renderAt('/tasks?diary=2');

    fireEvent.click(screen.getByRole('button', { name: 'next page' }));
    expect(screen.getByRole('status')).toHaveTextContent('/tasks?diary=2&page=2');
    expect(screen.getByText('page 2 of diary 2 after 2026-10-21__1_42_3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'page 3' }));
    expect(screen.getByText('page 3 of diary 2')).toBeInTheDocument();
  });

  it('opens a page by its offset when its history entry holds no cursor', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/tasks', search: '?page=2', state: { openTasksAfter: 7 } }]}>
        <TasksRoute t={(key) => key} diaries={[]} currentDiaryId={null} onDiaryChange={vi.fn()} onManageDiaries={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('page 2 of diary all')).toBeInTheDocument();
  });
});
