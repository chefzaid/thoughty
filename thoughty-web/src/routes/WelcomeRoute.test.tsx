import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { WelcomePageProps } from '../components/Welcome/WelcomePage';
import { makeDiary } from '../test/diaryFixture';
import WelcomeRoute from './WelcomeRoute';

vi.mock('../components/Welcome/WelcomePage', () => ({
  default: ({ onOpenJournal, onOpenMemoir, onOpenImport }: WelcomePageProps) => (
    <>
      <button type="button" onClick={onOpenJournal}>journal</button>
      <button type="button" onClick={onOpenMemoir}>memoir</button>
      <button type="button" onClick={onOpenImport}>import</button>
    </>
  ),
}));

function Where() {
  const location = useLocation();
  return <p>{`${useNavigationType()} ${location.pathname}${location.search}`}</p>;
}

function renderRoute(diaries = [makeDiary({ id: 4, name: 'Notes', isDefault: true })]) {
  render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route
          path="/welcome"
          element={<WelcomeRoute diaries={diaries} onFinish={vi.fn()} onSetDiaryTemplate={vi.fn()} t={(key) => key} />}
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WelcomeRoute', () => {
  it.each([
    ['journal', 'REPLACE /journal?diary=4'],
    ['memoir', 'REPLACE /memoir'],
    ['import', 'REPLACE /import-export?diary=4&section=import&format=txt'],
  ])('opens %s in place of the welcome page', (button, where) => {
    renderRoute();
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByText(where)).toBeInTheDocument();
  });

  it('opens every diary without a default one', () => {
    renderRoute([]);
    fireEvent.click(screen.getByRole('button', { name: 'journal' }));
    expect(screen.getByText('REPLACE /journal?diary=all')).toBeInTheDocument();
  });
});
