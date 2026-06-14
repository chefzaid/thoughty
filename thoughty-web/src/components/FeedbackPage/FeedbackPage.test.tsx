import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FeedbackPage from './FeedbackPage';

const messages: Record<string, string> = {
  feedbackEyebrow: 'Feedback',
  feedbackTitle: 'Shape what Thoughty becomes next.',
  feedbackSubtitle: 'Share feature ideas.',
  feedbackFormTitle: 'Submit an idea',
  feedbackTitleLabel: 'Idea title',
  feedbackDetailsLabel: 'What would this improve?',
  feedbackSubmit: 'Post idea',
  feedbackSuccess: 'Your idea has been added.',
  feedbackBoardKicker: 'Feature requests',
  feedbackBoardTitle: 'Ideas from the community',
  feedbackStatusPlanned: 'Planned',
  feedbackStatusReviewing: 'Reviewing',
  feedbackStatusOpen: 'Open',
  feedbackIdeaOfflineTitle: 'Offline writing mode',
  feedbackIdeaOfflineBody: 'Write without a connection.',
  feedbackIdeaPromptsTitle: 'Personalized writing prompts',
  feedbackIdeaPromptsBody: 'Suggest prompts.',
  feedbackIdeaSharingTitle: 'Shared public collections',
  feedbackIdeaSharingBody: 'Group public thoughts.',
  feedbackVote: 'Vote',
  feedbackVoted: 'Voted',
  feedbackVoteAria: 'Vote for {title}',
  back: 'Back',
  copyright: 'Copyright',
  madeWithLove: 'Made with care',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  contact: 'Contact',
};

function t(key: string, params?: Record<string, string | number>) {
  const message = messages[key] ?? key;
  return Object.entries(params ?? {}).reduce(
    (current, [paramKey, value]) => current.replace(`{${paramKey}}`, String(value)),
    message,
  );
}

describe('FeedbackPage', () => {
  it('renders the feedback form and initial ideas', () => {
    render(<FeedbackPage t={t} theme="dark" onBackHome={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Shape what Thoughty becomes next.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Idea title')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Offline writing mode' })).toBeInTheDocument();
  });

  it('adds a submitted idea to the board', async () => {
    const user = userEvent.setup();
    render(<FeedbackPage t={t} theme="light" onBackHome={vi.fn()} />);

    await user.type(screen.getByLabelText('Idea title'), 'Mood calendar');
    await user.type(screen.getByLabelText('What would this improve?'), 'Show mood patterns by month.');
    await user.click(screen.getByRole('button', { name: 'Post idea' }));

    expect(screen.getByRole('status')).toHaveTextContent('Your idea has been added.');
    expect(screen.getByRole('heading', { name: 'Mood calendar' })).toBeInTheDocument();
  });

  it('upvotes an existing idea once', async () => {
    const user = userEvent.setup();
    render(<FeedbackPage t={t} theme="dark" onBackHome={vi.fn()} />);

    const voteButton = screen.getByRole('button', { name: 'Vote for Offline writing mode' });
    await user.click(voteButton);

    expect(voteButton).toBeDisabled();
    expect(voteButton).toHaveTextContent('43');
    expect(voteButton).toHaveTextContent('Voted');
  });

  it('navigates back home from the hero action', async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<FeedbackPage t={t} theme="dark" onBackHome={onBackHome} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
