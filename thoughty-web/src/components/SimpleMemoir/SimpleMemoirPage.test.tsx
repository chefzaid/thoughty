import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { memoirChaptersWith, memoirOverview } from '../../test/memoirFixture';
import SimpleMemoirPage, { type SimpleMemoirPageProps } from './SimpleMemoirPage';

const memoirService = { fetchOverview: vi.fn(), answer: vi.fn() };
const attachmentsService = { uploadAttachment: vi.fn() };
vi.mock('../../hooks/useMemoirService', () => ({ useMemoirService: () => memoirService }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

function renderPage(props: Partial<SimpleMemoirPageProps> = {}) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <SimpleMemoirPage t={t} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The page's heading once it reads `name`: the question, or what is said instead. */
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('SimpleMemoirPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Writing is what is left without a recorder, which keeps these tests on the page itself
    vi.stubGlobal('MediaRecorder', undefined);
    memoirService.fetchOverview.mockResolvedValue({ data: memoirOverview(), error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks this week’s question in large text with its chapter, and links to the full app', async () => {
    renderPage({ language: 'fr', theme: 'light' });

    expect(await heading('Comment était la maison ?')).toBeInTheDocument();
    expect(screen.getByText('memoirSimpleEyebrow · Enfance')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Comment était la maison ?' })).toHaveClass('simple-memoir', 'light');
    expect(screen.getByRole('link', { name: 'memoirSimpleFullApp' })).toHaveAttribute('href', '/memoir');
  });

  it('saves the answer, thanks the writer and says when the next question comes', async () => {
    memoirService.answer.mockResolvedValue({ data: { entryId: 90 }, error: null });
    renderPage();
    await heading('What was home like?');
    memoirService.fetchOverview.mockResolvedValue({ data: memoirOverview({}, memoirChaptersWith({ 'childhood-home': 90 })), error: null });

    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'A house by the sea.' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));

    expect(await heading('memoirSimpleThanksTitle')).toBeInTheDocument();
    expect(memoirService.answer).toHaveBeenCalledWith({ questionId: 'childhood-home', text: 'A house by the sea.' });
    expect(screen.getByRole('status')).toHaveTextContent('memoirSimpleSaved');
    expect(screen.getByText(/memoirSimpleNextOn Sunday, October 25/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'memoirSimpleNextQuestion' })).not.toBeInTheDocument();
  });

  it('asks the question the email link names, then offers this week’s once it is answered', async () => {
    memoirService.answer.mockResolvedValue({ data: { entryId: 91 }, error: null });
    renderPage({ questionId: 'work-path' });
    expect(await heading('How did you find your work?')).toBeInTheDocument();
    memoirService.fetchOverview.mockResolvedValue({ data: memoirOverview({}, memoirChaptersWith({ 'work-path': 91 })), error: null });

    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'At the harbour.' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));

    fireEvent.click(await screen.findByRole('button', { name: 'memoirSimpleNextQuestion' }));
    expect(await heading('What was home like?')).toBeInTheDocument();
  });

  it('says this week’s question is answered, or paused', async () => {
    memoirService.fetchOverview.mockResolvedValue({
      data: memoirOverview({ status: 'paused' }, memoirChaptersWith({ 'childhood-home': 90 })),
      error: null,
    });
    renderPage();

    expect(await heading('memoirSimpleThanksTitle')).toBeInTheDocument();
    expect(screen.getByText('memoirSimpleAnswered')).toBeInTheDocument();
    expect(screen.getByText('memoirPausedNotice')).toBeInTheDocument();
  });

  it.each([
    ['no memoir', memoirOverview(null), 'memoirSimpleNotStarted'],
    ['no diary', memoirOverview({ diaryId: null }), 'memoirSimpleNoDiary'],
    [
      'every question set aside',
      memoirOverview({ currentQuestionId: null }, memoirChaptersWith({}, { 'childhood-home': '2026-11-30', 'work-path': '2026-11-30' })),
      'memoirSimpleSetAside Monday, November 30',
    ],
    ['every question answered', memoirOverview({ currentQuestionId: null }, memoirChaptersWith({ 'childhood-home': 90, 'work-path': 91 })), 'memoirSimpleComplete'],
  ])('says so with %s', async (_case, data, text) => {
    memoirService.fetchOverview.mockResolvedValue({ data, error: null });
    renderPage();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByLabelText('memoirYourAnswer')).not.toBeInTheDocument();
  });

  it('shows the load, and a retry when the memoir cannot be read', async () => {
    memoirService.fetchOverview.mockResolvedValueOnce({ data: null, error: 'Failed' });
    renderPage();
    expect(screen.getByText('loading')).toBeInTheDocument();

    expect(await screen.findByRole('alert')).toHaveTextContent('memoirLoadError');
    fireEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    expect(await heading('What was home like?')).toBeInTheDocument();
  });

  it('keeps the question when the answer cannot be saved', async () => {
    memoirService.answer.mockResolvedValue({ data: null, error: 'memoirAnswerError' });
    renderPage();
    await heading('What was home like?');

    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'A house.' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('memoirAnswerError');
    expect(await heading('What was home like?')).toBeInTheDocument();
  });
});
