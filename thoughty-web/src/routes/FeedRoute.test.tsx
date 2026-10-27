import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import FeedRoute from './FeedRoute';

vi.mock('../components/FeedPage/FeedPage', () => ({
  default: ({ onOpenLeaderboard, readDates, ttsVoiceUri }: { onOpenLeaderboard: () => void; readDates?: boolean; ttsVoiceUri?: string }) => (
    <button type="button" onClick={onOpenLeaderboard} data-read-dates={String(readDates)} data-voice={ttsVoiceUri}>feed page</button>
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
});
