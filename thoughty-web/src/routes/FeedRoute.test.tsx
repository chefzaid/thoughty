import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import FeedRoute from './FeedRoute';
import { QuietModeContext } from '../components/QuietMode/quietMode';

interface MockFeedPageProps {
  onOpenLeaderboard?: () => void;
  readDates?: boolean;
  ttsVoiceUri?: string;
  filters?: { tag?: string; search?: string };
  onFiltersChange?: (filters: { tag?: string; search?: string }) => void;
}

vi.mock('../components/FeedPage/FeedPage', () => ({
  default: ({ onOpenLeaderboard, readDates, ttsVoiceUri, filters, onFiltersChange }: MockFeedPageProps) => (
    <>
      <button
        type="button"
        onClick={onOpenLeaderboard}
        data-leaderboard={String(Boolean(onOpenLeaderboard))}
        data-read-dates={String(readDates)}
        data-voice={ttsVoiceUri}
        data-filters={JSON.stringify(filters)}
      >
        feed page
      </button>
      <button type="button" onClick={() => onFiltersChange?.({ tag: 'Calm', search: 'sea walk' })}>open topic</button>
      <button type="button" onClick={() => onFiltersChange?.({})}>clear filters</button>
    </>
  ),
}));

vi.mock('../components/FeedPage/LeaderboardPage', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <button type="button" onClick={onBack}>leaderboard page</button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

describe('FeedRoute', () => {
  it('switches between the feed and the leaderboard through the view search parameter', () => {
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route path="/feed" element={<><FeedRoute t={(key) => key} /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'feed page' }));
    expect(screen.getByRole('status')).toHaveTextContent('/feed?view=leaderboard');

    fireEvent.click(screen.getByRole('button', { name: 'leaderboard page' }));
    expect(screen.getByRole('status')).toHaveTextContent('/feed');
    expect(screen.getByRole('button', { name: 'feed page' })).toBeInTheDocument();
  });

  it('has no leaderboard in quiet mode, and shows the feed at its address', () => {
    render(
      <QuietModeContext.Provider value>
        <MemoryRouter initialEntries={['/feed?view=leaderboard']}>
          <Routes>
            <Route path="/feed" element={<><FeedRoute t={(key) => key} /><LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </QuietModeContext.Provider>,
    );

    expect(screen.queryByRole('button', { name: 'leaderboard page' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^\/feed$/);
    expect(screen.getByRole('button', { name: 'feed page' })).toHaveAttribute('data-leaderboard', 'false');
  });

  it('passes the reading-aloud settings to the feed', () => {
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <FeedRoute t={(key) => key} readDates={false} ttsVoiceUri="voice-1" />
      </MemoryRouter>,
    );

    const feed = screen.getByRole('button', { name: 'feed page' });
    expect(feed).toHaveAttribute('data-read-dates', 'false');
    expect(feed).toHaveAttribute('data-voice', 'voice-1');
  });

  it('keeps the open topic and the word search in the address', () => {
    render(
      <MemoryRouter initialEntries={['/feed?tag=%20Gratitude%20&search=']}>
        <Routes>
          <Route path="/feed" element={<><FeedRoute t={(key) => key} /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'feed page' })).toHaveAttribute('data-filters', '{"tag":"Gratitude"}');

    fireEvent.click(screen.getByRole('button', { name: 'open topic' }));
    expect(screen.getByRole('status')).toHaveTextContent('/feed?tag=Calm&search=sea+walk');
    expect(screen.getByRole('button', { name: 'feed page' })).toHaveAttribute(
      'data-filters',
      '{"tag":"Calm","search":"sea walk"}',
    );

    fireEvent.click(screen.getByRole('button', { name: 'clear filters' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^\/feed$/);
  });

  it('shows the one entry of the address, ignoring an id that is not one, and leaves it with any other filter', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/feed?entry=42']}>
        <Routes>
          <Route path="/feed" element={<><FeedRoute t={(key) => key} /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'feed page' })).toHaveAttribute('data-filters', '{"entry":42}');
    fireEvent.click(screen.getByRole('button', { name: 'clear filters' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^\/feed$/);
    unmount();

    for (const id of ['0', '-3', '4.5', 'abc', '99999999999999999999']) {
      const view = render(
        <MemoryRouter initialEntries={[`/feed?entry=${id}`]}>
          <FeedRoute t={(key) => key} />
        </MemoryRouter>,
      );
      expect(screen.getByRole('button', { name: 'feed page' })).toHaveAttribute('data-filters', '{}');
      view.unmount();
    }
  });
});
