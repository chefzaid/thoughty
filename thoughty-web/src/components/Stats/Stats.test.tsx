import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import Stats from './Stats';
import { getTranslation } from '../../utils/translations';

function MockBar(props: { data: unknown }) {
    return createElement('div', { 'data-testid': 'mock-bar-chart' }, JSON.stringify(props.data));
}

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

// Mock Chart.js components to avoid canvas rendering issues
vi.mock('react-chartjs-2', () => {
    return { Bar: MockBar };
});

vi.mock('chart.js', () => ({
    Chart: { register: vi.fn() },
    CategoryScale: {},
    LinearScale: {},
    BarElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
    ArcElement: {}
}));

/** The Stats panels' headings, top to bottom, under the summary numbers. */
const PANEL_ORDER = [
    'Writing goal',
    'Journal Activity by Day',
    'Entries per Year',
    'Entries per Month',
    'When you write',
    'Top Tags',
    'Top Tags by Year',
    'Recorded moods',
    'Tags and moods',
    'Personal records',
    'Connections',
    'Words you use most',
    // What AI reads, last
    'Tone and Mood',
    'Subjects Discussed',
    'Writing Tendencies',
];

describe('Stats Component', () => {
    const defaultProps = {
        theme: 'dark' as const,
        t: (key: string, params?: { defaultValue?: string }): string => {
            const translations: Record<string, string> = {
                stats: 'Stats',
                statsOverview: 'Overview',
                loadingStats: 'Loading...',
                statsLoadError: 'Failed to load statistics',
                totalEntries: 'Total Entries',
                uniqueTags: 'Unique Tags',
                yearsActive: 'Years Active',
                avgPerYear: 'Avg. per Year',
                avgWordsPerEntry: 'Avg. Words',
                avgReadingTime: 'Avg. Read Time',
                thoughtsPerYear: 'Thoughts per Year',
                thoughtsPerMonth: 'Thoughts per Month',
                topTags: 'Top Tags',
                topTagsByYear: 'Top Tags by Year',
                journalActivityByDay: 'Journal Activity',
                toneMoodInsights: 'Tone and Mood',
                toneMoodInsightsDescription: 'AI analysis of your recent writing patterns.',
                dominantMood: 'Dominant Mood',
                dominantTone: 'Dominant Tone',
                analyzedEntries: 'Analyzed entries',
                moodMix: 'Mood Mix',
                toneMix: 'Tone Mix',
                toneMoodUnavailable: 'AI analysis is unavailable right now. Configure AI settings and try again later.',
                subjectsDiscussed: 'Subjects Discussed',
                subjectsDiscussedDescription: 'AI grouping of recurring subjects.',
                subjectsDiscussedUnavailable: 'Subject analysis is unavailable right now.',
                personalityInsights: 'Writing Tendencies',
                personalityFromDate: 'From',
                personalityToDate: 'To',
                analyzePersonality: 'Analyze',
                analyzingPersonality: 'Analyzing',
                personalityWordsAnalyzed: 'Words analyzed',
                personalityDateRange: 'Date range',
                personalityInvalidDateRange: 'Invalid date range',
                personalityAnalysisError: 'Analysis failed',
                personalityUnavailable: 'Analysis unavailable',
                personalityPrivacy: 'Aggregate data only',
                personalityDisclaimer: 'Non-clinical writing patterns',
                lessActivity: 'Less',
                moreActivity: 'More',
                noJournalActivity: 'No activity yet',
                year: 'Year'
            };
            return translations[key] || params?.defaultValue || key;
        }
    };

    const mockStatsData = {
        totalThoughts: 100,
        averageWordsPerEntry: 128,
        averageReadingTimeMinutes: 1,
        uniqueTagsCount: 15,
        thoughtsPerYear: { '2023': 40, '2024': 60 },
        thoughtsPerMonth: { '2023-12': 10, '2024-01': 20 },
        thoughtsPerDay: { '2024-01-15': 2, '2024-01-16': 1, '2024-01-18': 4 },
        thoughtsPerTag: { 'work': 30, 'personal': 20 },
        tagsPerYear: {
            '2024': { 'work': 20, 'personal': 10 },
            '2023': { 'work': 10 }
        },
        tagsPerMonth: {},
        toneMoodAnalysis: {
            dominantMood: 'reflective',
            dominantTone: 'candid',
            moodBreakdown: { reflective: 3, calm: 2 },
            toneBreakdown: { candid: 4, analytical: 1 },
            analyzedEntries: 5,
            summary: 'Recent entries are reflective and calm, with a candid tone.'
        },
        subjectAnalysis: {
            subjectBreakdown: { work: 4, relationships: 2, wellbeing: 1 },
            analyzedEntries: 5,
            summary: 'Recent entries focus on work, relationships, and wellbeing.'
        },
        correlations: {
            analyzedEntries: 100,
            entryConnections: [],
            tagConnections: []
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('displays loading state initially', () => {
        // Return a promise that never resolves immediately to test loading state
        (globalThis.fetch as Mock).mockImplementation(() => new Promise(() => { }));

        render(<Stats {...defaultProps} />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('displays error state on fetch failure', async () => {
        (globalThis.fetch as Mock).mockRejectedValue(new Error('API Error'));

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load statistics')).toBeInTheDocument();
        });
    });

    it('shows the recorded moods next to the AI insights, and an invitation when there are none', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockStatsData,
                moods: {
                    recordedEntries: 3,
                    averageMood: 4,
                    levels: [0, 0, 1, 1, 1],
                    months: [{ month: '2024-01', average: 4, entries: 3 }],
                    weekdays: Array.from({ length: 7 }, () => ({ average: null, entries: 0 })),
                    topFeelings: [{ feeling: 'calm', count: 2 }],
                    goodMoodTags: [{ tag: 'garden', entries: 2 }],
                    lowMoodTags: [],
                },
            }),
        });
        const onOpenJournalTag = vi.fn();

        const { unmount } = render(<Stats {...defaultProps} language="en" onOpenJournalTag={onOpenJournalTag} />);

        const panel = await screen.findByRole('region', { name: 'statsMoodTitle' });
        expect(within(panel).getByText('statsMoodAverage')).toBeInTheDocument();
        expect(within(panel).getByText('feelingCalm')).toBeInTheDocument();
        // The tags beside the moods follow the mood panel and open the journal filtered to the tag
        const tags = screen.getByRole('region', { name: 'statsMoodTagsTitle' });
        await userEvent.click(within(tags).getByRole('button', { name: 'statsMoodTagsOpen' }));
        expect(onOpenJournalTag).toHaveBeenCalledWith('garden');
        unmount();

        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockStatsData });
        render(<Stats {...defaultProps} />);

        expect(await screen.findByText('statsMoodEmpty')).toBeInTheDocument();
    });

    it('renders stats and charts on successful fetch', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            // Check headers
            expect(screen.getByText('Stats')).toBeInTheDocument();
            expect(screen.getByText('Overview')).toBeInTheDocument();
        });

        // Check summary cards
        expect(screen.getByText('100')).toBeInTheDocument(); // Total thoughts
        expect(screen.getByText('15')).toBeInTheDocument(); // Unique tags
        const yearsActiveCard = screen.getByText('Years Active').closest('.stat-card');
        expect(yearsActiveCard).not.toBeNull();
        expect(within(yearsActiveCard as HTMLElement).getByText('2')).toBeInTheDocument(); // Years active (2023, 2024)
        expect(screen.getByText('Avg. Words')).toBeInTheDocument();
        expect(screen.getByText('128')).toBeInTheDocument();
        expect(screen.getByText('Avg. Read Time')).toBeInTheDocument();
        expect(screen.getByText('1 min')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Writing Tendencies' })).toBeInTheDocument();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Check charts presence (via mock)
        const charts = screen.getAllByTestId('mock-bar-chart');
        expect(charts.length).toBeGreaterThan(0);
    });

    it('lays the panels out in the owner’s order, with the AI readings last', async () => {
        const englishT = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                ...mockStatsData,
                goals: [{
                    diaryId: 1, diaryName: 'Personal', diaryIcon: '📓', goalType: 'entries_per_week', goalTarget: 3, period: 'week',
                    periodStart: '2024-01-15', progress: 1, met: false, currentStreak: 0, longestStreak: 2, metPeriods: [],
                }],
                topWords: { month: '2024-01', words: [{ word: 'garden', count: 4 }] },
                moods: {
                    recordedEntries: 3, averageMood: 4, levels: [0, 0, 1, 1, 1],
                    months: [{ month: '2024-01', average: 4, entries: 3 }],
                    weekdays: Array.from({ length: 7 }, () => ({ average: null, entries: 0 })),
                    topFeelings: [], goodMoodTags: [{ tag: 'garden', entries: 2 }], lowMoodTags: [],
                },
            }),
        });

        const { container } = render(<Stats {...defaultProps} t={englishT} diaryId={1} language="en" />);

        await screen.findByText('Years Active');
        const summary = container.querySelector('.stats-summary') as HTMLElement;
        const grid = container.querySelector('.charts-grid') as HTMLElement;
        expect(summary.compareDocumentPosition(grid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        const headings = [...grid.querySelectorAll('h2')].map((heading) => heading.textContent?.trim());
        expect(headings).toEqual(PANEL_ORDER);
        expect(screen.queryByText('Your year in review')).not.toBeInTheDocument();
    });

    it('renders tag breakdown table', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Top Tags by Year')).toBeInTheDocument();
        });

        // Check if table contains specific data
        expect(screen.getByText('2024')).toBeInTheDocument();
        expect(screen.getByText(/work \(20\)/)).toBeInTheDocument();
        expect(screen.getByText(/personal \(10\)/)).toBeInTheDocument();
    });

    it('renders AI tone and mood insights when analysis is available', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Tone and Mood' })).toBeInTheDocument();
        });

        const dominantMoodCard = screen.getByText('Dominant Mood').closest('.tone-mood-highlight');
        const dominantToneCard = screen.getByText('Dominant Tone').closest('.tone-mood-highlight');

        expect(dominantMoodCard).not.toBeNull();
        expect(dominantToneCard).not.toBeNull();
        expect(within(dominantMoodCard as HTMLElement).getByText('Reflective')).toBeInTheDocument();
        expect(within(dominantToneCard as HTMLElement).getByText('Candid')).toBeInTheDocument();
        const toneCard = screen.getByRole('heading', { name: 'Tone and Mood' }).closest('section');
        expect(toneCard).not.toBeNull();
        expect(within(toneCard as HTMLElement).getByText('Recent entries are reflective and calm, with a candid tone.')).toBeInTheDocument();
        expect(within(toneCard as HTMLElement).getByText('Analyzed entries')).toBeInTheDocument();
        expect(within(toneCard as HTMLElement).getByText('5')).toBeInTheDocument();
    });

    it('renders AI subject insights when analysis is available', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Subjects Discussed' })).toBeInTheDocument();
        });

        expect(screen.getByText('Recent entries focus on work, relationships, and wellbeing.')).toBeInTheDocument();
        expect(screen.getByText('Relationships')).toBeInTheDocument();
        expect(screen.getByText('Wellbeing')).toBeInTheDocument();
    });

    const englishT = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

    it('labels the heatmap days in French with the profile language', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} t={(key, params) => getTranslation('fr', key, params)} language="fr" />);

        expect(await screen.findByLabelText('jeudi 18 janvier 2024. 4 entrées')).toBeInTheDocument();
        expect(screen.getByLabelText('mardi 16 janvier 2024. 1 entrée')).toBeInTheDocument();
    });

    it('renders the journaling heatmap when daily activity is available', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        const { container } = render(<Stats {...defaultProps} t={englishT} language="en" />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Journal Activity by Day' })).toBeInTheDocument();
        });

        expect(container.querySelectorAll('.heatmap-week').length).toBeGreaterThan(0);
        expect(screen.getByLabelText('Thursday, January 18, 2024. 4 entries')).toBeInTheDocument();
        expect(screen.getByLabelText('Tuesday, January 16, 2024. 1 entry')).toBeInTheDocument();
    });

    it('opens the journal for the selected day when a heatmap cell is clicked', async () => {
        const user = userEvent.setup();
        const onOpenJournalDay = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        render(<Stats {...defaultProps} t={englishT} language="en" onOpenJournalDay={onOpenJournalDay} />);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Journal Activity by Day' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('gridcell', { name: 'Thursday, January 18, 2024. 4 entries' }));

        expect(onOpenJournalDay).toHaveBeenCalledWith('2024-01-18');
    });

    it('opens a record’s entry, and the day of the busiest day', async () => {
        const user = userEvent.setup();
        const onOpenEntry = vi.fn();
        const onOpenJournalDay = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                ...mockStatsData,
                records: {
                    longestEntry: { entryId: 7, date: '2024-01-18', index: 3, words: 420 },
                    busiestDay: { date: '2024-01-18', entries: 4 },
                    longestStreak: null,
                    earliestEntry: null,
                    latestEntry: null,
                    firstEntry: { entryId: 2, date: '2024-01-16', index: 1 },
                },
            }),
        });

        render(<Stats {...defaultProps} t={englishT} language="en" onOpenEntry={onOpenEntry} onOpenJournalDay={onOpenJournalDay} />);

        const records = await screen.findByRole('region', { name: 'Personal records' });
        await user.click(within(records).getByRole('button', { name: 'Longest entry January 18, 2024 · #3' }));
        await user.click(within(records).getByRole('button', { name: 'Busiest day January 18, 2024' }));
        expect(onOpenEntry).toHaveBeenCalledWith(7);
        expect(onOpenJournalDay).toHaveBeenCalledWith('2024-01-18');
    });

    it('lists the words used most this month, each searching the journal, and leaves the card out for a server without them', async () => {
        const user = userEvent.setup();
        const onSearchJournal = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ...mockStatsData, topWords: { month: '2024-01', words: [{ word: 'river', count: 4 }] } }),
        });

        const { unmount } = render(<Stats {...defaultProps} t={englishT} language="en" onSearchJournal={onSearchJournal} />);

        const words = await screen.findByRole('region', { name: 'Words you use most' });
        expect(words).toHaveTextContent('in January');
        await user.click(within(words).getByRole('button', { name: 'Search the journal for river' }));
        expect(onSearchJournal).toHaveBeenCalledWith('river');
        unmount();

        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockStatsData });
        render(<Stats {...defaultProps} t={englishT} language="en" />);
        await screen.findByRole('region', { name: 'Personal records' });
        expect(screen.queryByRole('region', { name: 'Words you use most' })).not.toBeInTheDocument();
    });

    it('applies theme classes', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockStatsData
        });

        const { container } = render(<Stats {...defaultProps} theme="light" />);

        await waitFor(() => {
            expect(container.firstChild).toHaveClass('light');
        });
    });

    it('renders an unavailable state when AI analysis is missing', async () => {
        (globalThis.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                ...mockStatsData,
                toneMoodAnalysis: null,
                subjectAnalysis: null
            })
        });

        render(<Stats {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('AI analysis is unavailable right now. Configure AI settings and try again later.')).toBeInTheDocument();
        });
        expect(screen.getByText('Subject analysis is unavailable right now.')).toBeInTheDocument();
    });
});
