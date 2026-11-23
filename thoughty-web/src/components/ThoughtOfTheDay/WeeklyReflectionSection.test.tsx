import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeatureFlagsContext } from '../FeatureFlags/featureFlags';
import { DiaryAiContext } from '../DiaryAi/diaryAiScope';
import { getTranslation } from '../../utils/translations';
import WeeklyReflectionSection from './WeeklyReflectionSection';

const service = vi.hoisted(() => ({ fetchWeek: vi.fn(), reflectOnWeek: vi.fn() }));

vi.mock('../../hooks/useAuthenticatedService', () => ({
    useAuthenticatedService: () => service,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const reflection = {
    weekStart: '2026-11-15',
    weekEnd: '2026-11-21',
    themes: ['garden', 'slow mornings'],
    summary: 'You found calm in the garden.',
    question: 'What will you plant next?',
    analyzedEntries: 2,
    generatedAt: '2026-11-21T18:00:00.000Z',
};
const week = (overrides: object = {}) => ({
    data: { weekStart: '2026-11-15', weekEnd: '2026-11-21', entries: 2, reflection: null, aiAvailable: true, ...overrides },
    error: null,
});

const diaries = [{ id: 3, aiMode: 'on' as const }, { id: 4, aiMode: 'off' as const }];

function renderSection({ diaryId = null, ai = true, language = 'en' }: { diaryId?: number | null; ai?: boolean; language?: 'en' | 'fr' } = {}) {
    const translate = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    return render(
        <FeatureFlagsContext.Provider value={{ ai }}>
            <DiaryAiContext.Provider value={diaries}>
                <WeeklyReflectionSection diaryId={diaryId} language={language} theme="light" t={translate} />
            </DiaryAiContext.Provider>
        </FeatureFlagsContext.Provider>,
    );
}

describe('WeeklyReflectionSection', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-21T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('offers to reflect on the past seven days, then shows the themes, summary and question', async () => {
        service.fetchWeek.mockResolvedValue(week());
        service.reflectOnWeek.mockResolvedValue({ data: { reflection }, error: null });
        renderSection({ diaryId: 3 });

        const region = await screen.findByRole('region', { name: 'Your week' });
        expect(within(region).getByText('November 15, 2026 to November 21, 2026')).toBeInTheDocument();
        expect(within(region).getByText(/Look back on the past seven days with AI/)).toBeInTheDocument();
        expect(service.fetchWeek).toHaveBeenCalledWith('2026-11-21', 3);

        await userEvent.click(within(region).getByRole('button', { name: 'Reflect on my week' }));

        expect(service.reflectOnWeek).toHaveBeenCalledWith('2026-11-21', 3);
        expect(within(region).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['garden', 'slow mornings']);
        expect(within(region).getByText('You found calm in the garden.')).toHaveClass('privacy-text');
        expect(within(region).getByText('What will you plant next?')).toHaveClass('privacy-text');
        expect(within(region).getByRole('button', { name: 'Reflect again' })).toBeInTheDocument();
    });

    it('shows the saved reflection with its own week, and says why one cannot be made', async () => {
        service.fetchWeek.mockResolvedValue(week({ reflection: { ...reflection, weekStart: '2026-11-13', weekEnd: '2026-11-19' } }));
        service.reflectOnWeek.mockResolvedValue({ data: null, error: 'apiError_REVIEW_REFLECTION_UNAVAILABLE' });
        renderSection();

        const region = await screen.findByRole('region', { name: 'Your week' });
        expect(within(region).getByText('November 13, 2026 to November 19, 2026')).toBeInTheDocument();
        await userEvent.click(within(region).getByRole('button', { name: 'Reflect again' }));

        expect(within(region).getByRole('alert')).toHaveTextContent('Your week could not be read right now.');
        expect(within(region).getByText('What will you plant next?')).toBeInTheDocument();
        expect(service.fetchWeek).toHaveBeenCalledWith('2026-11-21', null);
    });

    it('falls back to its own message when the request gives none', async () => {
        service.fetchWeek.mockResolvedValue(week());
        service.reflectOnWeek.mockResolvedValue({ data: null, error: null });
        renderSection();

        await userEvent.click(await screen.findByRole('button', { name: 'Reflect on my week' }));

        expect(screen.getByRole('alert')).toHaveTextContent(t('weeklyReflectionError'));
    });

    it('asks once at a time and shows that it is reading', async () => {
        service.fetchWeek.mockResolvedValue(week());
        let answer: (value: unknown) => void = () => undefined;
        service.reflectOnWeek.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
        renderSection();

        const button = await screen.findByRole('button', { name: 'Reflect on my week' });
        await userEvent.click(button);
        expect(screen.getByRole('button', { name: 'Reading your week…' })).toHaveAttribute('aria-disabled', 'true');
        await userEvent.click(screen.getByRole('button', { name: 'Reading your week…' }));
        expect(service.reflectOnWeek).toHaveBeenCalledTimes(1);

        answer({ data: { reflection }, error: null });
        expect(await screen.findByRole('button', { name: 'Reflect again' })).toHaveAttribute('aria-disabled', 'false');
    });

    it('says the week is empty and offers nothing to send', async () => {
        service.fetchWeek.mockResolvedValue(week({ entries: 0 }));
        renderSection();

        const region = await screen.findByRole('region', { name: 'Your week' });
        expect(within(region).getByText(/Nothing written in the past seven days yet/)).toBeInTheDocument();
        expect(within(region).queryByRole('button')).not.toBeInTheDocument();
    });

    it('stays hidden when AI is off, not available, or the week cannot be loaded', async () => {
        const { unmount } = renderSection({ ai: false });
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(service.fetchWeek).not.toHaveBeenCalled();
        unmount();

        service.fetchWeek.mockResolvedValueOnce(week({ aiAvailable: false }));
        const second = renderSection();
        await waitFor(() => expect(service.fetchWeek).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        second.unmount();

        service.fetchWeek.mockResolvedValueOnce({ data: null, error: 'weeklyReflectionLoadError' });
        renderSection();
        await waitFor(() => expect(service.fetchWeek).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('ignores an answer that arrives after it is gone', async () => {
        let answer: (value: unknown) => void = () => undefined;
        service.fetchWeek.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
        const { unmount } = renderSection();
        unmount();

        answer(week());
        await Promise.resolve();
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('says a diary with AI off is not read, in place of the reflection, in English and French', async () => {
        service.fetchWeek.mockResolvedValue(week({ reflection }));
        const { unmount } = renderSection({ diaryId: 4 });

        const region = await screen.findByRole('region', { name: 'Your week' });
        expect(within(region).getByRole('note')).toHaveTextContent('AI is off for this diary: no AI feature reads its entries.');
        expect(within(region).queryByRole('button')).not.toBeInTheDocument();
        expect(within(region).queryByText('What will you plant next?')).not.toBeInTheDocument();
        unmount();

        renderSection({ diaryId: 4, language: 'fr' });
        expect(await screen.findByRole('note')).toHaveTextContent("L'IA est désactivée pour ce journal : aucune fonction d'IA ne lit ses entrées.");
    });

    it('says the diaries with AI off are left out while all diaries are shown, not for one diary with AI on', async () => {
        service.fetchWeek.mockResolvedValue(week());
        const { unmount } = renderSection();

        const region = await screen.findByRole('region', { name: 'Your week' });
        expect(within(region).getByText(/locked entries are never sent\. .* Diaries with AI off are left out\.$/)).toBeInTheDocument();
        unmount();

        renderSection({ diaryId: 3 });
        await screen.findByRole('button', { name: 'Reflect on my week' });
        expect(screen.queryByText(/Diaries with AI off are left out/)).not.toBeInTheDocument();
    });
});
