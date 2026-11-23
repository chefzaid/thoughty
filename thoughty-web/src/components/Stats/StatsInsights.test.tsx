import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatsInsights from './StatsInsights';

const translations: Record<string, string> = {
    toneMoodInsights: 'Tone and Mood',
    toneMoodInsightsDescription: 'Tone description',
    dominantMood: 'Dominant Mood',
    dominantTone: 'Dominant Tone',
    analyzedEntries: 'Analyzed entries',
    moodMix: 'Mood Mix',
    toneMix: 'Tone Mix',
    toneMoodUnavailable: 'Tone unavailable',
    subjectsDiscussed: 'Subjects Discussed',
    subjectsDiscussedDescription: 'Subject description',
    subjectsDiscussedUnavailable: 'Subjects unavailable',
};

const t = (key: string) => translations[key] ?? key;

describe('StatsInsights', () => {
    it('renders subject counts independently from unavailable tone analysis', () => {
        render(
            <StatsInsights
                themeClass="dark"
                toneMoodAnalysis={null}
                subjectAnalysis={{
                    subjectBreakdown: { creative_projects: 3, family: 2 },
                    analyzedEntries: 3,
                    summary: 'Creative projects and family recur.',
                }}
                t={t}
            />,
        );

        expect(screen.getByText('Tone unavailable')).toBeInTheDocument();
        expect(screen.getByText('Creative Projects')).toBeInTheDocument();
        expect(screen.getByText('Creative projects and family recur.')).toBeInTheDocument();
        expect(screen.queryByText('Subjects unavailable')).not.toBeInTheDocument();
    });

    it('caps visual percentages even when API counts are unexpected', () => {
        const { container } = render(
            <StatsInsights
                themeClass="light"
                subjectAnalysis={{
                    subjectBreakdown: { work: 999 },
                    analyzedEntries: 2,
                    summary: 'Work leads.',
                }}
                t={t}
            />,
        );

        const subjectCard = screen.getByRole('heading', { name: 'Subjects Discussed' }).closest('section');
        expect(subjectCard).not.toBeNull();
        expect(within(subjectCard as HTMLElement).getByText('999')).toBeInTheDocument();
        expect(container.querySelector('.tone-mood-bar-fill.subject')).toHaveStyle({ width: '100%' });
    });

    it('says the diary shown has AI off in place of both readings', () => {
        render(<StatsInsights themeClass="light" toneMoodAnalysis={null} subjectAnalysis={null} diaryAi={{ aiOff: true, aiOffLeftOut: false }} t={t} />);

        const notes = screen.getAllByRole('note');
        expect(notes).toHaveLength(2);
        expect(notes[0]).toHaveTextContent('diaryAiOffNotice');
        expect(notes[0]).toHaveClass('light');
        expect(screen.queryByText('Tone unavailable')).not.toBeInTheDocument();
        expect(screen.queryByText('Subjects unavailable')).not.toBeInTheDocument();
    });

    it('says the readings of all diaries left those with AI off out, only once there is a reading', () => {
        render(
            <StatsInsights
                themeClass="dark"
                toneMoodAnalysis={null}
                subjectAnalysis={{ subjectBreakdown: { family: 2 }, analyzedEntries: 2, summary: '' }}
                diaryAi={{ aiOff: false, aiOffLeftOut: true }}
                t={t}
            />,
        );

        const subjects = screen.getByRole('region', { name: 'Subjects Discussed' });
        expect(within(subjects).getByText('diaryAiOffLeftOut')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Tone and Mood' })).queryByText('diaryAiOffLeftOut')).not.toBeInTheDocument();
    });
});
