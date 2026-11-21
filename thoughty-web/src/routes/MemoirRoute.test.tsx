import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import MemoirRoute from './MemoirRoute';

vi.mock('../components/MemoirPage/MemoirPage', () => ({
  default: ({ initialQuestionId, onOpenEntry, onOpenBook, onOpenSimpleMode }: {
    initialQuestionId: string | null;
    onOpenEntry: (entryId: number) => void;
    onOpenBook: (diaryId: number) => void;
    onOpenSimpleMode: () => void;
  }) => (
    <>
      <p>{`question ${initialQuestionId ?? 'none'}`}</p>
      <button type="button" onClick={() => onOpenEntry(81)}>open entry</button>
      <button type="button" onClick={() => onOpenBook(6)}>open book</button>
      <button type="button" onClick={onOpenSimpleMode}>open simple mode</button>
    </>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderRoute(initialEntry: string, simpleMode = false) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={<><MemoirRoute t={(key) => key} diaries={[]} onDiariesChanged={vi.fn()} simpleMode={simpleMode} /><LocationProbe /></>}
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

  it('opens the simple screen from the page', () => {
    renderRoute('/memoir');
    fireEvent.click(screen.getByRole('button', { name: 'open simple mode' }));
    expect(screen.getByRole('status')).toHaveTextContent('/memoir/simple');
  });

  it('sends the weekly email link to the simple screen in simple mode', () => {
    renderRoute('/memoir?question=places-journey', true);
    expect(screen.getByRole('status')).toHaveTextContent('/memoir/simple?question=places-journey');
  });

  it('keeps the full page in simple mode when no question is asked', () => {
    renderRoute('/memoir', true);
    expect(screen.getByText('question none')).toBeInTheDocument();
  });
});
