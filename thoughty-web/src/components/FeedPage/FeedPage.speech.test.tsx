import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const feedService = { fetchPublicFeed, fetchFollows, setFollowing: vi.fn(), setEntryLike: vi.fn() };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

interface FakeUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
}

const synth = globalThis.speechSynthesis;
const spoken: FakeUtterance[] = [];

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const createEntry = (id: number, username: string, content = `Entry ${id} is about the day`) => ({
  id,
  date: '2026-08-01',
  index: 1,
  title: null as string | null,
  timeOfDay: null,
  tags: [],
  content,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 0,
  likeCount: 0,
  liked: false,
  author: { id: id + 100, username, avatarUrl: null, isFollowed: false },
});

const feedPage = (entries: ReturnType<typeof createEntry>[], page: number, hasMore: boolean) => ({
  data: { entries, total: 3, page, totalPages: 2, hasMore },
  error: null,
});

function finishCurrent() {
  act(() => spoken.at(-1)?.onend?.());
}

async function chooseListen(username: string, option: 'listenThisEntry' | 'listenFromHere') {
  fireEvent.click(await screen.findByRole('button', { name: `listenEntryBy ${username}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: option }));
}

describe('FeedPage reading aloud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spoken.length = 0;
    fetchFollows.mockResolvedValue({ data: { following: [], followerCount: 0 }, error: null });
    (synth.speak as ReturnType<typeof vi.fn>).mockImplementation((utterance: FakeUtterance) => spoken.push(utterance));
    (synth.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([
      { voiceURI: 'chosen', lang: 'en-GB', name: 'Chosen', default: false },
      { voiceURI: 'french', lang: 'fr-FR', name: 'French', default: true },
    ]);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string;
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    });
  });

  it('reads one entry with its title, date and the chosen voice', async () => {
    fetchPublicFeed.mockResolvedValueOnce(feedPage([
      { ...createEntry(1, 'Ada', 'I walked to the river and it was calm'), title: 'River' },
      createEntry(2, 'Lin'),
    ], 1, false));

    render(<FeedPage t={t} readDates ttsVoiceUri="chosen" />);
    await chooseListen('Ada', 'listenThisEntry');

    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.text).toBe('Saturday, August 1, 2026. River. I walked to the river and it was calm');
    expect(spoken[0]!.voice?.voiceURI).toBe('chosen');
    const reading = screen.getByRole('button', { name: 'stopListening', pressed: true });
    expect(reading.closest('article')).toHaveTextContent('Ada');
    expect(reading.closest('article')).toHaveClass('reading');
    expect(screen.getAllByRole('button', { name: 'stopListening' })).toHaveLength(2);

    finishCurrent();
    expect(spoken).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'listenEntryBy Ada' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reads a French entry with a French voice', async () => {
    fetchPublicFeed.mockResolvedValueOnce(feedPage([
      createEntry(1, 'Ada', "Aujourd'hui je suis allée à la mer avec mes amis"),
    ], 1, false));

    render(<FeedPage t={t} readDates={false} ttsVoiceUri="chosen" />);
    await chooseListen('Ada', 'listenThisEntry');

    expect(spoken[0]!.lang).toBe('fr-FR');
    expect(spoken[0]!.voice?.voiceURI).toBe('french');
  });

  it('reads on through the loaded entries and then the next page', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce(feedPage([createEntry(1, 'Ada'), createEntry(2, 'Lin')], 1, true))
      .mockResolvedValueOnce(feedPage([createEntry(3, 'Kim')], 2, false));

    render(<FeedPage t={t} readDates={false} />);
    await chooseListen('Ada', 'listenFromHere');

    finishCurrent();
    finishCurrent();
    await waitFor(() => expect(spoken).toHaveLength(3));
    expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 2, 10);
    expect(await screen.findByText('Entry 3 is about the day')).toBeInTheDocument();

    finishCurrent();
    expect(spoken.map((utterance) => utterance.text)).toEqual([
      'Entry 1 is about the day',
      'Entry 2 is about the day',
      'Entry 3 is about the day',
    ]);
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'stopListening' })).toHaveLength(0));
    expect(fetchPublicFeed).toHaveBeenCalledTimes(2);
  });

  it('reads on into a page the infinite scroll already loaded, sharing its request', async () => {
    let resolvePage: (value: unknown) => void = () => undefined;
    fetchPublicFeed
      .mockResolvedValueOnce(feedPage([createEntry(1, 'Ada')], 1, true))
      .mockReturnValueOnce(new Promise((resolve) => { resolvePage = resolve; }));

    render(<FeedPage t={t} readDates={false} />);
    await chooseListen('Ada', 'listenFromHere');
    fireEvent.click(screen.getByRole('button', { name: 'loadMoreEntries' }));
    finishCurrent();

    await act(async () => resolvePage(feedPage([createEntry(2, 'Lin')], 2, false)));

    await waitFor(() => expect(spoken).toHaveLength(2));
    expect(spoken[1]!.text).toBe('Entry 2 is about the day');
    expect(fetchPublicFeed).toHaveBeenCalledTimes(2);
  });

  it('stops reading when the feed switches scope', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce(feedPage([createEntry(1, 'Ada'), createEntry(2, 'Lin')], 1, false))
      .mockResolvedValueOnce(feedPage([createEntry(5, 'Me')], 1, false));

    render(<FeedPage t={t} readDates={false} />);
    await chooseListen('Ada', 'listenFromHere');
    fireEvent.click(screen.getByRole('button', { name: 'feedMine' }));
    finishCurrent();

    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'listenEntryBy Me' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('stops reading when the page unmounts', async () => {
    fetchPublicFeed.mockResolvedValueOnce(feedPage([createEntry(1, 'Ada'), createEntry(2, 'Lin')], 1, false));

    const { unmount } = render(<FeedPage t={t} readDates={false} />);
    await chooseListen('Ada', 'listenFromHere');
    unmount();
    finishCurrent();

    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
  });

  it('offers no listen button without speech synthesis', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis')!;
    Reflect.deleteProperty(globalThis, 'speechSynthesis');
    try {
      fetchPublicFeed.mockResolvedValueOnce(feedPage([createEntry(1, 'Ada')], 1, false));
      render(<FeedPage t={t} />);

      expect(await screen.findByText('Entry 1 is about the day')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'listenEntryBy Ada' })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, 'speechSynthesis', original);
    }
  });
});
