import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReviewService, type YearReview } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import YearReviewPage, { type YearReviewPageProps } from './YearReviewPage';

const reviewService = { fetchReview: vi.fn(), readMood: vi.fn() };
const entriesService = { createEntry: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: (factory: unknown) => (factory === createReviewService ? reviewService : entriesService),
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;

const review = (overrides: Partial<YearReview> = {}): YearReview => ({
  year: 2025,
  diaryId: null,
  availableYears: [2025, 2024],
  totals: { entries: 214, words: 61240, writingDays: 182, longestStreak: 38, favorites: 9, attachments: 40, averageWords: 286 },
  previousYear: { entries: 202, words: 58000, writingDays: 175 },
  months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, entries: index === 2 ? 31 : 15, words: 5000 })),
  weekdays: [30, 28, 25, 27, 29, 35, 40],
  topTags: [{ tag: 'travel', count: 40 }, { tag: 'family', count: 30 }],
  newTags: ['garden'],
  highlights: [
    { kind: 'first', entryId: 11, date: '2025-01-02', excerpt: 'A quiet start.', words: 3, tags: [] },
    { kind: 'favorite', entryId: 12, date: '2025-06-14', excerpt: 'The lake with everyone.', words: 4, tags: ['family'] },
  ],
  mood: null,
  recordedMood: null,
  aiAvailable: true,
  ...overrides,
});

function renderPage(props: Partial<YearReviewPageProps> = {}) {
  const handlers = { onChangeYear: vi.fn(), onChangeDiary: vi.fn(), onOpenEntry: vi.fn() };
  const view = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <YearReviewPage
        language="en"
        diaries={[{ id: 3, name: 'Travel' } as YearReviewPageProps['diaries'][number]]}
        year={2025}
        diaryId={null}
        t={t}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...handlers, unmount: view.unmount };
}

describe('YearReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewService.fetchReview.mockResolvedValue({ data: review(), error: null });
  });

  it('shows the year in numbers, its rhythm, themes, and moments to reread', async () => {
    const { onOpenEntry } = renderPage();

    expect(await screen.findByText('214')).toBeInTheDocument();
    expect(reviewService.fetchReview).toHaveBeenCalledWith(2025, null);
    expect(screen.getByRole('heading', { level: 1, name: 'reviewTitle 2025' })).toBeInTheDocument();
    expect(screen.getByText('reviewCompared +12 | 2024')).toBeInTheDocument();
    expect(screen.getByText('reviewBusiestMonth March | reviewEntries_other 31')).toBeInTheDocument();
    expect(screen.getByText('reviewBusiestWeekday Sunday')).toBeInTheDocument();
    const themes = screen.getByRole('region', { name: 'reviewThemesTitle' });
    expect(within(themes).getByText('travel')).toBeInTheDocument();
    expect(within(themes).getByText('garden')).toBeInTheDocument();
    const highlights = screen.getByRole('region', { name: 'reviewHighlightsTitle' });
    expect(within(highlights).getByRole('article', { name: 'reviewHighlightFavorite' })).toHaveTextContent('The lake with everyone.');

    fireEvent.click(within(highlights).getAllByRole('button', { name: 'reviewReadEntry' })[1]!);
    expect(onOpenEntry).toHaveBeenCalledWith(12);
  });

  it('changes the year and the diaries in view', async () => {
    const { onChangeYear, onChangeDiary } = renderPage();
    await screen.findByText('214');

    fireEvent.change(screen.getByLabelText('reviewYearLabel'), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText('reviewScopeLabel'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('reviewScopeLabel'), { target: { value: 'all' } });

    expect(onChangeYear).toHaveBeenCalledWith(2024);
    expect(onChangeDiary).toHaveBeenNthCalledWith(1, 3);
    expect(onChangeDiary).toHaveBeenNthCalledWith(2, null);
  });

  it('moves to the latest year with entries when the default year is empty', async () => {
    reviewService.fetchReview.mockResolvedValue({ data: review({ year: 2026, totals: { ...review().totals, entries: 0 } }), error: null });

    const { onChangeYear } = renderPage({ year: null });

    await waitFor(() => expect(onChangeYear).toHaveBeenCalledWith(2025, { replace: true }));
  });

  it('explains a year without entries', async () => {
    reviewService.fetchReview.mockResolvedValueOnce({ data: review({ totals: { ...review().totals, entries: 0 } }), error: null });
    renderPage({ year: 2019 });
    expect(await screen.findByText('reviewEmptyYear 2019')).toBeInTheDocument();
  });

  it('asks to write a first entry when the journal is empty', async () => {
    reviewService.fetchReview.mockResolvedValue({ data: review({ availableYears: [], totals: { ...review().totals, entries: 0 } }), error: null });
    renderPage();
    expect(await screen.findByText('reviewEmptyJournal')).toBeInTheDocument();
  });

  it('offers to retry a failed load', async () => {
    reviewService.fetchReview.mockResolvedValueOnce({ data: null, error: 'down' }).mockResolvedValue({ data: review(), error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'reviewRetry' }));

    expect(await screen.findByText('214')).toBeInTheDocument();
  });

  it('reads the mood of the year on request and draws it', async () => {
    reviewService.readMood.mockResolvedValue({
      data: {
        mood: {
          months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }, { month: '2025-02', mood: 'tired', valence: -1 }, { month: '2025-04', mood: 'bright', valence: 2 }],
          summary: 'A hopeful start and a bright spring.',
          analyzedEntries: 14,
          generatedAt: '2026-01-02T10:00:00.000Z',
        },
      },
      error: null,
    });
    renderPage();
    const moodCard = await screen.findByRole('region', { name: 'reviewMoodTitle' });
    expect(within(moodCard).getByText('reviewMoodPrivacy')).toBeInTheDocument();

    fireEvent.click(within(moodCard).getByRole('button', { name: 'reviewMoodAction' }));

    expect(await within(moodCard).findByText('A hopeful start and a bright spring.')).toBeInTheDocument();
    expect(reviewService.readMood).toHaveBeenCalledWith(2025, null);
    expect(within(moodCard).getByRole('img', { name: /January: hopeful, February: tired, April: bright/ })).toBeInTheDocument();
    expect(moodCard.querySelectorAll('polyline')).toHaveLength(2);
    expect(within(moodCard).getByRole('button', { name: 'reviewMoodAgain' })).toBeInTheDocument();
  });

  it('labels an AI reading as such and suggests recording moods', async () => {
    reviewService.fetchReview.mockResolvedValue({
      data: review({
        mood: {
          months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }],
          summary: 'A hopeful start.',
          analyzedEntries: 5,
          generatedAt: '2026-01-02T10:00:00.000Z',
        },
      }),
      error: null,
    });
    renderPage();
    const moodCard = await screen.findByRole('region', { name: 'reviewMoodTitle' });

    expect(within(moodCard).getByText('reviewMoodAiSource')).toBeInTheDocument();
    expect(within(moodCard).getByText('reviewMoodRecordHint')).toBeInTheDocument();
    expect(within(moodCard).queryByText('reviewMoodRecordedSource')).not.toBeInTheDocument();
  });

  it('draws the arc from recorded moods without AI, even when an AI reading is saved', async () => {
    reviewService.fetchReview.mockResolvedValue({
      data: review({
        mood: {
          months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }],
          summary: 'An old AI reading.',
          analyzedEntries: 5,
          generatedAt: '2026-01-02T10:00:00.000Z',
        },
        recordedMood: {
          entries: 9,
          average: 3.6,
          months: [{ month: '2025-03', average: 2, entries: 4 }, { month: '2025-04', average: 4.8, entries: 5 }],
          topFeelings: [{ feeling: 'calm', count: 4 }, { feeling: 'nostalgic', count: 2 }],
        },
      }),
      error: null,
    });
    renderPage();
    const moodCard = await screen.findByRole('region', { name: 'reviewMoodTitle' });

    expect(within(moodCard).getByText('reviewMoodRecordedSource')).toBeInTheDocument();
    expect(within(moodCard).getByText('reviewMoodRecordedSummary 3.6 | moodLevel4 | reviewEntries_other 9')).toBeInTheDocument();
    expect(within(moodCard).getByRole('img', { name: /March: moodLevel2, April: moodLevel5/ })).toBeInTheDocument();
    expect(moodCard.querySelectorAll('polyline')).toHaveLength(1);
    expect(within(moodCard).getByText('reviewMoodRecordedFeelings feelingCalm, nostalgic')).toBeInTheDocument();
    expect(within(moodCard).queryByText('An old AI reading.')).not.toBeInTheDocument();
    expect(within(moodCard).queryByRole('button')).not.toBeInTheDocument();
  });

  it('reports a failed mood reading and explains when AI is not set up', async () => {
    reviewService.readMood.mockResolvedValue({ data: null, error: 'unavailable' });
    renderPage();
    const moodCard = await screen.findByRole('region', { name: 'reviewMoodTitle' });

    fireEvent.click(within(moodCard).getByRole('button', { name: 'reviewMoodAction' }));

    expect(await within(moodCard).findByRole('alert')).toHaveTextContent('reviewMoodError');
  });

  it('hides the mood button without AI', async () => {
    reviewService.fetchReview.mockResolvedValue({ data: review({ aiAvailable: false }), error: null });
    renderPage();

    expect(await screen.findByText('reviewMoodUnavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reviewMoodAction' })).not.toBeInTheDocument();
  });

  it('posts an edited summary to the public feed and links to it', async () => {
    entriesService.createEntry.mockResolvedValue({ success: true, entryId: 99 });
    const { onOpenEntry } = renderPage();
    const share = await screen.findByRole('region', { name: 'reviewShareTitle' });

    fireEvent.click(within(share).getByRole('button', { name: 'reviewShareAction' }));
    const text = within(share).getByLabelText('reviewShareLabel');
    expect((text as HTMLTextAreaElement).value).toContain('reviewShareText 2025');
    expect((text as HTMLTextAreaElement).value).not.toContain('reviewShareThemes');
    fireEvent.click(within(share).getByLabelText('reviewShareIncludeThemes'));
    expect((text as HTMLTextAreaElement).value).toContain('reviewShareThemes travel, family');
    fireEvent.change(text, { target: { value: 'My year, in my words.' } });
    fireEvent.click(within(share).getByRole('button', { name: 'reviewSharePost' }));

    expect(await within(share).findByText('reviewSharePosted')).toBeInTheDocument();
    expect(entriesService.createEntry).toHaveBeenCalledWith(expect.objectContaining({ text: 'My year, in my words.', visibility: 'public', tags: [], diaryId: null }));
    fireEvent.click(within(share).getByRole('button', { name: 'reviewShareOpen' }));
    expect(onOpenEntry).toHaveBeenCalledWith(99);
  });

  it('keeps the form open when posting fails, and can be cancelled', async () => {
    entriesService.createEntry.mockResolvedValue({ success: false });
    renderPage();
    const share = await screen.findByRole('region', { name: 'reviewShareTitle' });
    fireEvent.click(within(share).getByRole('button', { name: 'reviewShareAction' }));

    fireEvent.click(within(share).getByRole('button', { name: 'reviewSharePost' }));
    expect(await within(share).findByRole('alert')).toHaveTextContent('reviewShareError');

    fireEvent.click(within(share).getByRole('button', { name: 'cancel' }));
    expect(within(share).getByRole('button', { name: 'reviewShareAction' })).toBeInTheDocument();
  });

  it('prints the review as a booklet', async () => {
    const print = vi.spyOn(globalThis, 'print').mockImplementation(() => undefined);
    renderPage({ theme: 'light' });

    fireEvent.click(await screen.findByRole('button', { name: 'reviewPrint' }));

    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it('marks the page for its booklet print rules only while it is shown', async () => {
    const { unmount } = renderPage();
    const root = document.documentElement;

    expect(root).toHaveClass('year-review-active');
    expect(await screen.findByText('214')).toBeInTheDocument();
    unmount();
    expect(root).not.toHaveClass('year-review-active');
  });
});
