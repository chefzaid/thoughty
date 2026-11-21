import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SimpleMemoirRoute from './SimpleMemoirRoute';

vi.mock('../components/SimpleMemoir/SimpleMemoirPage', () => ({
  default: ({ questionId }: { questionId: string | null }) => <p>{`question ${questionId ?? 'none'}`}</p>,
}));

function renderRoute(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SimpleMemoirRoute t={(key) => key} />
    </MemoryRouter>,
  );
}

describe('SimpleMemoirRoute', () => {
  it('asks the question the weekly email link names first', () => {
    renderRoute('/memoir/simple?question=places-journey');
    expect(screen.getByText('question places-journey')).toBeInTheDocument();
  });

  it('asks this week’s question without one', () => {
    renderRoute('/memoir/simple');
    expect(screen.getByText('question none')).toBeInTheDocument();
  });
});
