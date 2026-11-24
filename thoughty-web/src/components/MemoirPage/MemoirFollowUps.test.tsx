import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoirFollowUps from './MemoirFollowUps';
import { getTranslation } from '../../utils/translations';

const memoirService = { followUps: vi.fn() };
vi.mock('../../hooks/useMemoirService', () => ({ useMemoirService: () => memoirService }));
const localAiService = { memoirFollowUps: vi.fn() };
vi.mock('../../hooks/useLocalAiService', () => ({ useLocalAiService: () => localAiService }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const answer = 'A narrow house with a fig tree, and my grandmother singing in the kitchen.';

function renderFollowUps(text = answer, onUse = vi.fn()) {
  const view = render(<MemoirFollowUps questionId="childhood-home" questionText="What was home like?" answer={text} onUse={onUse} t={t} />);
  return { ...view, onUse };
}

const ask = async (name: string | RegExp = 'Ask me follow-up questions') => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('MemoirFollowUps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoirService.followUps.mockResolvedValue({ data: { questions: ['What song did she sing?', 'What could you see from the fig tree?'] }, error: null });
  });

  it('asks about the answer and offers each question to answer at the end of it', async () => {
    const { onUse } = renderFollowUps();
    expect(screen.getByRole('group', { name: 'Interview mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask me follow-up questions' })).toHaveAccessibleDescription(/asks only about what you wrote/);

    await ask();

    expect(memoirService.followUps).toHaveBeenCalledWith({ questionId: 'childhood-home', text: answer, asked: [] });
    const list = screen.getByRole('list', { name: 'To tell more' });
    expect(list).toHaveTextContent('What song did she sing?');
    expect(screen.getByText('What song did she sing?')).toHaveClass('privacy-text');

    fireEvent.click(screen.getByRole('button', { name: 'Answer this: What song did she sing?' }));
    expect(onUse).toHaveBeenCalledWith('What song did she sing?');
    expect(screen.queryByText('What song did she sing?')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Question added to the end of your answer.');
  });

  it('asks other questions in the next round, sending back those already offered', async () => {
    renderFollowUps();
    await ask();
    memoirService.followUps.mockResolvedValueOnce({ data: { questions: ['Who taught her the song?'] }, error: null });

    await ask('Ask me other questions');

    expect(memoirService.followUps).toHaveBeenLastCalledWith({
      questionId: 'childhood-home',
      text: answer,
      asked: ['What song did she sing?', 'What could you see from the fig tree?'],
    });
    expect(screen.getByRole('list', { name: 'To tell more' })).toHaveTextContent('Who taught her the song?');
    expect(screen.queryByText('What song did she sing?')).not.toBeInTheDocument();
  });

  it('sends back only the twelve most recent questions offered', async () => {
    renderFollowUps();
    for (let round = 0; round < 5; round += 1) {
      memoirService.followUps.mockResolvedValueOnce({ data: { questions: [`A${round}?`, `B${round}?`, `C${round}?`] }, error: null });
      await ask(round === 0 ? 'Ask me follow-up questions' : 'Ask me other questions');
    }
    await ask('Ask me other questions');

    const { asked } = memoirService.followUps.mock.lastCall![0] as { asked: string[] };
    expect(asked).toHaveLength(12);
    expect(asked[0]).toBe('A1?');
    expect(asked.at(-1)).toBe('C4?');
  });

  it('says to write more when the answer gives nothing to build on yet', async () => {
    memoirService.followUps.mockResolvedValue({ data: { questions: [] }, error: null });
    renderFollowUps('Yes.');

    await ask();

    expect(screen.getByText('Write a little more first: the questions build only on what you wrote.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('asks nothing before the answer has words, and says why', async () => {
    renderFollowUps('   ');
    const button = screen.getByRole('button', { name: 'Ask me follow-up questions' });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Write some of your answer first: the questions build only on what you wrote.');
    await ask();
    expect(memoirService.followUps).not.toHaveBeenCalled();
  });

  it('says why the questions could not be asked, and asks again', async () => {
    memoirService.followUps
      .mockResolvedValueOnce({ data: null, error: 'apiError_AI_KEY_NOT_CONFIGURED' })
      .mockResolvedValueOnce({ data: null, error: null });
    renderFollowUps();

    await ask();
    expect(screen.getByRole('alert')).toHaveTextContent('No OpenRouter API key is set up.');
    await ask();
    expect(screen.getByRole('alert')).toHaveTextContent('The follow-up questions could not be asked. Try again later.');
  });

  it('shows it is thinking while the questions are asked', async () => {
    let finish: (value: unknown) => void = () => undefined;
    memoirService.followUps.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderFollowUps();

    fireEvent.click(screen.getByRole('button', { name: 'Ask me follow-up questions' }));
    const busy = screen.getByRole('button', { name: 'Thinking of questions…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await act(async () => finish({ data: { questions: ['Why the fig tree?'] }, error: null }));
    expect(screen.getByRole('button', { name: 'Ask me other questions' })).toBeEnabled();
  });

  it('follows the interface language', () => {
    render(<MemoirFollowUps questionId="childhood-home" questionText="What was home like?" answer={answer} onUse={vi.fn()} t={(key, params) => getTranslation('fr', key, params)} />);

    expect(screen.getByRole('group', { name: 'Mode entretien' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me poser des questions de relance' })).toBeInTheDocument();
  });

  it('asks the writer’s own model in a memoir diary set to it, never Thoughty’s server, and says why it gave none', async () => {
    localAiService.memoirFollowUps
      .mockResolvedValueOnce({ data: ['Which song?'], refusal: null })
      .mockResolvedValueOnce({ data: null, refusal: 'localModelUnreadable' });
    render(<MemoirFollowUps questionId="childhood-home" questionText="What was home like?" answer={answer} onUse={vi.fn()} aiMode="local" t={t} />);

    await ask();
    expect(localAiService.memoirFollowUps).toHaveBeenCalledWith({ question: 'What was home like?', answer, asked: [] });
    expect(screen.getByRole('list', { name: 'To tell more' })).toHaveTextContent('Which song?');

    await ask('Ask me other questions');
    expect(localAiService.memoirFollowUps).toHaveBeenLastCalledWith({ question: 'What was home like?', answer, asked: ['Which song?'] });
    expect(screen.getByRole('alert')).toHaveTextContent('Your model answered, but not in the form asked for.');
    expect(memoirService.followUps).not.toHaveBeenCalled();
  });
});
