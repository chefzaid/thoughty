import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MemoirOverview, MemoirProgram } from '../../services/api';
import { makeDiary } from '../../test/diaryFixture';
import { createTestQueryClient } from '../../test/queryClient';
import MemoirPage, { type MemoirPageProps } from './MemoirPage';

const memoirService = {
  fetchOverview: vi.fn(),
  start: vi.fn(),
  update: vi.fn(),
  skip: vi.fn(),
  answer: vi.fn(),
  leave: vi.fn(),
};
// One stand-in for every authenticated service the page uses: attachments and life eras
const attachmentsService = { uploadAttachment: vi.fn(), transcribeAttachment: vi.fn(), list: vi.fn() };

vi.mock('../../hooks/useMemoirService', () => ({ useMemoirService: () => memoirService }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const chapters: MemoirOverview['chapters'] = [
  {
    id: 'childhood',
    title: { en: 'Childhood', fr: 'Enfance' },
    questions: [
      { id: 'childhood-home', text: { en: 'What was home like?', fr: 'Comment était la maison ?' }, answer: null },
      {
        id: 'childhood-play',
        text: { en: 'What games did you play?', fr: 'À quoi jouiez-vous ?' },
        answer: { entryId: 81, answeredAt: '2026-10-12T09:00:00.000Z' },
      },
    ],
  },
  {
    id: 'work',
    title: { en: 'Work', fr: 'Travail' },
    questions: [{ id: 'work-path', text: { en: 'How did you find your work?', fr: 'Comment avez-vous trouvé votre métier ?' }, answer: null }],
  },
];

const program: MemoirProgram = {
  diaryId: 6,
  status: 'active',
  emailEnabled: true,
  emailAvailable: true,
  deliveryWeekday: 0,
  timeZone: 'Europe/Paris',
  currentQuestionId: 'childhood-home',
  nextDeliveryAt: '2026-10-25T08:00:00.000Z',
  startedAt: '2026-10-04T15:20:00.000Z',
};

const overview = (programOverrides: Partial<MemoirProgram> | null = {}, answered = 1): MemoirOverview => ({
  program: programOverrides === null ? null : { ...program, ...programOverrides },
  chapters,
  progress: { answered, total: 3, words: 1200, estimatedPages: 5 },
});

const diaries = [
  makeDiary({ id: 6, name: 'My memoir', icon: '📖' }),
  makeDiary({ id: 2, name: 'Thoughts', icon: '💭' }),
];

function renderPage(props: Partial<MemoirPageProps> = {}) {
  const handlers = { onOpenEntry: vi.fn(), onOpenBook: vi.fn(), onDiariesChanged: vi.fn() };
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoirPage diaries={diaries} t={t} {...handlers} {...props} />
    </QueryClientProvider>,
  );
  return handlers;
}

describe('MemoirPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoirService.fetchOverview.mockResolvedValue({ data: overview(), error: null });
    attachmentsService.list.mockResolvedValue({ data: { lifeEras: [], limit: 100 }, error: null });
  });

  it('introduces the program and starts it in a new diary named by the writer', async () => {
    memoirService.fetchOverview.mockResolvedValueOnce({ data: overview(null, 0), error: null });
    memoirService.start.mockResolvedValue({ data: overview({}, 0), error: null });
    const { onDiariesChanged } = renderPage();

    expect(await screen.findByRole('heading', { name: 'memoirIntroTitle' })).toBeInTheDocument();
    expect(screen.getByText('memoirIntroStats 3 2')).toBeInTheDocument();
    expect(screen.getByText('Childhood')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('memoirDiaryNameLabel'), { target: { value: '  Grandpa’s story ' } });
    fireEvent.change(screen.getByLabelText('memoirWeekdayLabel'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('memoirWeeklyEmail'));
    fireEvent.click(screen.getByRole('button', { name: 'memoirStart' }));

    await waitFor(() => expect(memoirService.start).toHaveBeenCalledWith({
      diaryName: 'Grandpa’s story',
      emailEnabled: false,
      deliveryWeekday: 3,
      timeZone: expect.any(String),
    }));
    expect(onDiariesChanged).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'memoirThisWeek' })).toBeInTheDocument();
  });

  it('starts in an existing diary and reports a failed start', async () => {
    memoirService.fetchOverview.mockResolvedValueOnce({ data: overview(null, 0), error: null });
    memoirService.start.mockResolvedValue({ data: null, error: 'Diary not found' });
    renderPage();

    fireEvent.change(await screen.findByLabelText('memoirDiaryLabel'), { target: { value: '2' } });
    expect(screen.queryByLabelText('memoirDiaryNameLabel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'memoirStart' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('memoirStartError');
    expect(memoirService.start).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 2 }));
  });

  it('shows this week’s question, progress by chapter, and opens the book converter', async () => {
    const { onOpenBook } = renderPage({ language: 'fr' });

    const week = (await screen.findByRole('heading', { name: 'memoirThisWeek' })).closest('section')!;
    expect(within(week).getByText('Enfance')).toBeInTheDocument();
    expect(within(week).getByText('Comment était la maison ?')).toBeInTheDocument();
    expect(within(week).getByText(/memoirNextQuestion dimanche 25 octobre/)).toBeInTheDocument();

    const progress = screen.getByRole('heading', { name: 'memoirProgressTitle' }).closest('section')!;
    expect(within(progress).getByText('memoirAnsweredCount 1 3')).toBeInTheDocument();
    expect(within(progress).getByText('1 / 2')).toBeInTheDocument();
    expect(within(progress).getByRole('meter', { name: 'memoirChapterProgress Enfance 1 2' })).toHaveAttribute('value', '1');

    fireEvent.click(within(progress).getByRole('button', { name: 'memoirMakeBook' }));
    expect(onOpenBook).toHaveBeenCalledWith(6);
  });

  it('answers this week’s question and confirms it was saved', async () => {
    memoirService.answer.mockResolvedValue({ data: { questionId: 'childhood-home', entryId: 90 }, error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'memoirAnswerQuestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('memoirAnswerEmpty');

    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: '  A fig tree in the yard. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));

    await waitFor(() => expect(memoirService.answer).toHaveBeenCalledWith({ questionId: 'childhood-home', text: 'A fig tree in the yard.' }));
    expect(await screen.findByText('memoirAnswerSaved')).toBeInTheDocument();
    expect(screen.queryByLabelText('memoirYourAnswer')).not.toBeInTheDocument();
    expect(memoirService.fetchOverview).toHaveBeenCalledTimes(2);
  });

  it('places an answer in one of the writer’s life eras', async () => {
    attachmentsService.list.mockResolvedValue({
      data: {
        lifeEras: [{ id: 3, name: 'Childhood', emoji: null, color: null, note: null, startDate: '1960-01-01', endDate: '1972-12-31', createdAt: '', updatedAt: '' }],
        limit: 100,
      },
      error: null,
    });
    memoirService.answer.mockResolvedValue({ data: { questionId: 'childhood-home', entryId: 90 }, error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'memoirAnswerQuestion' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'memoirEraLabel' }), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'A fig tree.' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));

    await waitFor(() => expect(memoirService.answer).toHaveBeenCalledWith({ questionId: 'childhood-home', text: 'A fig tree.', eraId: 3 }));
  });

  it('keeps the answer open when it cannot be saved', async () => {
    memoirService.answer.mockResolvedValue({ data: null, error: 'Conflict' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'memoirAnswerQuestion' }));
    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'Answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('memoirAnswerError');
    expect(screen.getByLabelText('memoirYourAnswer')).toHaveValue('Answer');

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByLabelText('memoirYourAnswer')).not.toBeInTheDocument();
  });

  it('swaps in another question, and reports when that fails', async () => {
    memoirService.skip
      .mockResolvedValueOnce({ data: overview({ currentQuestionId: 'work-path' }), error: null })
      .mockResolvedValueOnce({ data: null, error: 'Failed' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'memoirSkip' }));
    const week = screen.getByRole('heading', { name: 'memoirThisWeek' }).closest('section')!;
    expect(await within(week).findByText('How did you find your work?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'memoirSkip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('memoirSaveError');
  });

  it('opens answers in the journal and answers other questions in place', async () => {
    memoirService.fetchOverview.mockResolvedValue({ data: overview({ currentQuestionId: 'childhood-play' }), error: null });
    const { onOpenEntry } = renderPage();

    const week = (await screen.findByRole('heading', { name: 'memoirThisWeek' })).closest('section')!;
    expect(within(week).getByText(/memoirAnsweredThisWeek/)).toBeInTheDocument();
    fireEvent.click(within(week).getByRole('button', { name: 'memoirOpenAnswer' }));
    expect(onOpenEntry).toHaveBeenCalledWith(81);

    const list = screen.getByRole('heading', { name: 'memoirAllQuestions' }).closest('section')!;
    expect(within(list).getByText('memoirThisWeekBadge')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'memoirAnswerQuestion: How did you find your work?' }));
    expect(within(list).getByRole('form', { name: 'How did you find your work?' })).toBeInTheDocument();
  });

  it('opens the question from the email link inside the chapter list', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage({ initialQuestionId: 'work-path' });

    expect(await screen.findByRole('form', { name: 'How did you find your work?' })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('explains paused programs, a deleted diary, unreachable email, and a finished memoir', async () => {
    memoirService.fetchOverview.mockResolvedValue({
      data: overview({ status: 'paused', diaryId: null, emailAvailable: false, currentQuestionId: null }, 3),
      error: null,
    });
    renderPage();

    expect(await screen.findByText('memoirPausedNotice')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('memoirNoDiary');
    expect(screen.getByText('memoirEmailUnavailable')).toBeInTheDocument();
    expect(screen.getByText('memoirComplete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirMakeBook' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'memoirAnswerQuestion: How did you find your work?' })).toBeDisabled();
  });

  it('saves settings, pauses and resumes, and stops the memoir after confirmation', async () => {
    memoirService.update.mockImplementation(async (request: { status?: string }) => ({
      data: overview(request.status ? { status: request.status as MemoirProgram['status'] } : {}),
      error: null,
    }));
    memoirService.leave.mockResolvedValue({ data: { success: true }, error: null });
    renderPage();

    const settings = (await screen.findByRole('heading', { name: 'memoirSettings' })).closest('section')!;
    fireEvent.change(within(settings).getByLabelText('memoirWeekdayLabel'), { target: { value: '5' } });
    fireEvent.change(within(settings).getByLabelText('memoirDiaryLabel'), { target: { value: '2' } });
    fireEvent.click(within(settings).getByRole('button', { name: 'memoirSaveSettings' }));
    await waitFor(() => expect(memoirService.update).toHaveBeenCalledWith({
      deliveryWeekday: 5,
      emailEnabled: true,
      timeZone: expect.any(String),
      diaryId: 2,
    }));
    expect(await within(settings).findByText('memoirSettingsSaved')).toBeInTheDocument();

    fireEvent.click(within(settings).getByRole('button', { name: 'memoirPause' }));
    await waitFor(() => expect(memoirService.update).toHaveBeenLastCalledWith({ status: 'paused' }));
    fireEvent.click(await within(settings).findByRole('button', { name: 'memoirResume' }));
    await waitFor(() => expect(memoirService.update).toHaveBeenLastCalledWith({ status: 'active' }));

    memoirService.fetchOverview.mockResolvedValue({ data: overview(null), error: null });
    fireEvent.click(within(settings).getByRole('button', { name: 'memoirLeave' }));
    expect(screen.getByText('memoirLeaveMessage')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'memoirLeave' }).at(-1)!);
    });
    await waitFor(() => expect(memoirService.leave).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: 'memoirIntroTitle' })).toBeInTheDocument();
  });

  it('reports a failed settings change', async () => {
    memoirService.update.mockResolvedValue({ data: null, error: 'Failed' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'memoirSaveSettings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('memoirSaveError');
  });

  it('offers to retry when the memoir cannot be loaded', async () => {
    memoirService.fetchOverview.mockResolvedValueOnce({ data: null, error: 'Failed' });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('memoirLoadError');
    fireEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    expect(await screen.findByRole('heading', { name: 'memoirThisWeek' })).toBeInTheDocument();
  });
});
