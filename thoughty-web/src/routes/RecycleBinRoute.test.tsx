import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import RecycleBinRoute from './RecycleBinRoute';

vi.mock('../components/RecycleBin/RecycleBinPage', () => ({
  default: ({ page, onChangePage, onBack }: {
    page: number;
    onChangePage: (page: number, options?: { replace?: boolean }) => void;
    onBack: () => void;
  }) => (
    <>
      <p>{`page ${page}`}</p>
      <button type="button" onClick={() => onChangePage(3)}>page 3</button>
      <button type="button" onClick={() => onChangePage(1, { replace: true })}>first page</button>
      <button type="button" onClick={onBack}>back</button>
    </>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

function renderAt(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={<><RecycleBinRoute t={(key) => key} diaries={[]} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RecycleBinRoute', () => {
  it('reads the page from the address and treats anything else as the first page', () => {
    renderAt('/recycle-bin?page=2');
    expect(screen.getByText('page 2')).toBeInTheDocument();
  });

  it.each(['/recycle-bin', '/recycle-bin?page=abc', '/recycle-bin?page=-4'])('opens %s on the first page', (path) => {
    renderAt(path);
    expect(screen.getByText('page 1')).toBeInTheDocument();
  });

  it('keeps the page in the address and goes back to the journal', () => {
    renderAt('/recycle-bin?page=2');

    fireEvent.click(screen.getByRole('button', { name: 'page 3' }));
    expect(screen.getByRole('status')).toHaveTextContent('/recycle-bin?page=3');

    fireEvent.click(screen.getByRole('button', { name: 'first page' }));
    expect(screen.getByRole('status')).toHaveTextContent('/recycle-bin');

    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByRole('status')).toHaveTextContent('/journal');
  });
});
