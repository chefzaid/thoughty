import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import MemoirRoute from './MemoirRoute';

vi.mock('../components/MemoirPage/MemoirPage', () => ({
  default: ({ initialQuestionId, onOpenEntry, onOpenBook }: {
    initialQuestionId: string | null;
    onOpenEntry: (entryId: number) => void;
    onOpenBook: (diaryId: number) => void;
  }) => (
    <>
      <p>{`question ${initialQuestionId ?? 'none'}`}</p>
      <button type="button" onClick={() => onOpenEntry(81)}>open entry</button>
      <button type="button" onClick={() => onOpenBook(6)}>open book</button>
    </>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderRoute(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={<><MemoirRoute t={(key) => key} diaries={[]} onDiariesChanged={vi.fn()} /><LocationProbe /></>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MemoirRoute', () => {
  it('opens the question named in the weekly email link', () => {
    renderRoute('/memoir?question=places-journey');
    expect(screen.getByText('question places-journey')).toBeInTheDocument();
  });

  it('opens answers in the journal and the memoir diary in the book converter', () => {
    renderRoute('/memoir');
    expect(screen.getByText('question none')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open entry' }));
    expect(screen.getByRole('status')).toHaveTextContent('/journal?entry=81');

    fireEvent.click(screen.getByRole('button', { name: 'open book' }));
    expect(screen.getByRole('status')).toHaveTextContent('/import-export?diary=6&section=book&format=txt');
  });
});
