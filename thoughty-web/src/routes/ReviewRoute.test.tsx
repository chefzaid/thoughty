import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ReviewRoute from './ReviewRoute';
import StatsRoute from './StatsRoute';

vi.mock('../components/YearReview/YearReviewPage', () => ({
  default: ({ year, diaryId, onChangeYear, onChangeDiary, onOpenEntry }: {
    year: number | null;
    diaryId: number | null;
    onChangeYear: (year: number, options?: { replace?: boolean }) => void;
    onChangeDiary: (diaryId: number | null) => void;
    onOpenEntry: (entryId: number) => void;
  }) => (
    <>
      <p>{`year ${year ?? 'none'} diary ${diaryId ?? 'all'}`}</p>
      <button type="button" onClick={() => onChangeYear(2024)}>pick 2024</button>
      <button type="button" onClick={() => onChangeYear(2023, { replace: true })}>fall back to 2023</button>
      <button type="button" onClick={() => onChangeDiary(3)}>pick diary</button>
      <button type="button" onClick={() => onChangeDiary(null)}>all diaries</button>
      <button type="button" onClick={() => onOpenEntry(12)}>open entry</button>
    </>
  ),
}));
vi.mock('../components/Stats/Stats', () => ({
  default: ({ teaser }: { teaser?: React.ReactNode }) => <>{teaser}<p>stats</p></>,
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderAt(initialEntry: string, element: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={<>{element}<LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewRoute', () => {
  const review = <ReviewRoute t={(key) => key} diaries={[]} />;

  it('reads the year and diary from the address', () => {
    renderAt('/review?year=2025&diary=3', review);
    expect(screen.getByText('year 2025 diary 3')).toBeInTheDocument();
  });

  it('treats a missing or invalid year and diary as unset', () => {
    renderAt('/review?year=abc&diary=-2', review);
    expect(screen.getByText('year none diary all')).toBeInTheDocument();
  });

  it('keeps the year and diary in the address and opens entries in the journal', () => {
    renderAt('/review?diary=3', review);

    fireEvent.click(screen.getByRole('button', { name: 'pick 2024' }));
    expect(screen.getByRole('status')).toHaveTextContent('/review?diary=3&year=2024');
    fireEvent.click(screen.getByRole('button', { name: 'all diaries' }));
    expect(screen.getByRole('status')).toHaveTextContent('/review?year=2024');
    fireEvent.click(screen.getByRole('button', { name: 'fall back to 2023' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick diary' }));
    expect(screen.getByRole('status')).toHaveTextContent('/review?year=2023&diary=3');
    fireEvent.click(screen.getByRole('button', { name: 'open entry' }));
    expect(screen.getByRole('status')).toHaveTextContent('/journal?entry=12');
  });
});

describe('StatsRoute', () => {
  it('invites the writer to the year in review of the diary in view', () => {
    renderAt('/stats', (
      <StatsRoute diaries={[]} currentDiaryId={4} onDiaryChange={vi.fn()} onManageDiaries={vi.fn()} t={(key) => key} />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'reviewTeaserAction' }));

    expect(screen.getByRole('status')).toHaveTextContent('/review?diary=4');
  });

  it('opens the review of all diaries when none is selected', () => {
    renderAt('/stats', (
      <StatsRoute diaries={[]} currentDiaryId={null} onDiaryChange={vi.fn()} onManageDiaries={vi.fn()} theme="light" t={(key) => key} />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'reviewTeaserAction' }));

    expect(screen.getByRole('status')).toHaveTextContent(/^\/review$/);
  });
});
