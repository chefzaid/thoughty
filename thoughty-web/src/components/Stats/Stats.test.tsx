import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Stats from './Stats';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch })
    };
});

// Mock Chart.js components to avoid canvas rendering issues
vi.mock('react-chartjs-2', () => {
    const MockBar = function MockBar(props: { data: unknown }): JSX.Element {
        return (
            <div data-testid="mock-bar-chart">
                {JSON.stringify(props.data)}
            </div>
        );
    };
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

describe('Stats Component', () => {
    const defaultProps = {
        theme: 'dark' as const,
        t: (key: string, params?: { defaultValue?: string }): string => {
            const translations: Record<string, string> = {
                stats: 'Stats',
                statsOverview: 'Overview',
                loadingStats: 'Loading...',
                totalEntries: 'Total Entries',
                uniqueTags: 'Unique Tags',
                yearsActive: 'Years Active',
                avgPerYear: 'Avg. per Year',
                thoughtsPerYear: 'Thoughts per Year',
                thoughtsPerMonth: 'Thoughts per Month',
                topTags: 'Top Tags',
                topTagsByYear: 'Top Tags by Year',
                year: 'Year'
            };
            return translations[key] || params?.defaultValue || key;
        }
    };

    const mockStatsData = {
        totalThoughts: 100,
        uniqueTagsCount: 15,
        thoughtsPerYear: { '2023': 40, '2024': 60 },
        thoughtsPerMonth: { '2023-12': 10, '2024-01': 20 },
        thoughtsPerTag: { 'work': 30, 'personal': 20 },
        tagsPerYear: {
            '2024': { 'work': 20, 'personal': 10 },
            '2023': { 'work': 10 }
        },
        tagsPerMonth: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
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
        expect(screen.getByText('2')).toBeInTheDocument(); // Years active (2023, 2024)

        // Check charts presence (via mock)
        const charts = screen.getAllByTestId('mock-bar-chart');
        expect(charts.length).toBeGreaterThan(0);
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
});
