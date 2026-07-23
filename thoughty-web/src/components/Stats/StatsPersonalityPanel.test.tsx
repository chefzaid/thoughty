import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatsPersonalityPanel from './StatsPersonalityPanel';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ authFetch }),
}));

const translations: Record<string, string> = {
    personalityInsights: 'Writing Tendencies',
    personalityFromDate: 'From',
    personalityToDate: 'To',
    analyzePersonality: 'Analyze',
    analyzingPersonality: 'Analyzing',
    analyzedEntries: 'Analyzed entries',
    personalityWordsAnalyzed: 'Words analyzed',
    personalityDateRange: 'Date range',
    personalityInvalidDateRange: 'Invalid date range',
    personalityAnalysisError: 'Analysis failed',
    personalityUnavailable: 'Analysis unavailable',
    personalityPrivacy: 'Aggregate data only',
    personalityDisclaimer: 'Non-clinical writing patterns',
};

const t = (key: string) => translations[key] ?? key;

describe('StatsPersonalityPanel', () => {
    beforeEach(() => {
        authFetch.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('requests the selected scope and renders bounded writing tendencies', async () => {
        authFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                analysis: {
                    traits: [
                        {
                            label: 'Reflective planning',
                            score: 82,
                            evidence:
                                'Planning and reflection vocabulary recur.',
                        },
                    ],
                    summary:
                        'The writing suggests a reflective approach to decisions.',
                    analyzedEntries: 184,
                    analyzedWords: 28412,
                    fromDate: '2025-01-03',
                    toDate: '2025-12-19',
                },
            }),
        });

        const { rerender } = render(
            <StatsPersonalityPanel themeClass="dark" diaryId={3} t={t} />
        );
        fireEvent.change(screen.getByLabelText('From'), {
            target: { value: '2025-01-01' },
        });
        fireEvent.change(screen.getByLabelText('To'), {
            target: { value: '2025-12-31' },
        });
        await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

        await waitFor(() =>
            expect(authFetch).toHaveBeenCalledWith(
                '/api/stats/personality-analysis',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        diaryId: 3,
                        fromDate: '2025-01-01',
                        toDate: '2025-12-31',
                    }),
                })
            )
        );

        expect(
            await screen.findByText(
                'The writing suggests a reflective approach to decisions.'
            )
        ).toBeInTheDocument();
        const trait = screen.getByText('Reflective planning').closest('li');
        expect(trait).not.toBeNull();
        expect(
            within(trait as HTMLElement).getByText('82')
        ).toBeInTheDocument();
        expect(screen.getByText('28,412')).toBeInTheDocument();
        expect(screen.getByText('Aggregate data only')).toBeInTheDocument();

        rerender(<StatsPersonalityPanel themeClass="dark" diaryId={4} t={t} />);
        expect(
            screen.queryByText(
                'The writing suggests a reflective approach to decisions.'
            )
        ).not.toBeInTheDocument();
    });

    it('rejects an inverted date range without making a request', async () => {
        render(<StatsPersonalityPanel themeClass="light" t={t} />);
        fireEvent.change(screen.getByLabelText('From'), {
            target: { value: '2025-12-31' },
        });
        fireEvent.change(screen.getByLabelText('To'), {
            target: { value: '2025-01-01' },
        });
        await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Invalid date range'
        );
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('handles unavailable and failed analysis independently', async () => {
        authFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ analysis: null }),
        });
        render(<StatsPersonalityPanel themeClass="dark" t={t} />);

        await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
        expect(
            await screen.findByText('Analysis unavailable')
        ).toBeInTheDocument();

        authFetch.mockResolvedValueOnce({ ok: false });
        await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Analysis failed'
        );
    });
});
