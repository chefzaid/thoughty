import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FeedbackPage from './FeedbackPage';

const { authFetch, authState } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  authState: { isAuthenticated: true },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    authFetch,
    isAuthenticated: authState.isAuthenticated,
  }),
}));

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
  feedbackVote: 'Vote',
  feedbackVoted: 'Voted',
  feedbackVoteAria: 'Vote for {title}',
  feedbackLoading: 'Loading community ideas...',
  feedbackLoadError: 'Board unavailable',
  feedbackEmpty: 'No ideas yet',
  feedbackSubmitError: 'Submit failed',
  feedbackVoteError: 'Vote failed',
  feedbackSignInToSubmit: 'Sign in to post',
  feedbackSignInToVote: 'Sign in to vote for {title}',
  back: 'Back',
  copyright: 'Copyright',
  madeWithLove: 'Made with care',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  contact: 'Contact',
};

const REQUESTS = [
  {
    id: 1,
    title: 'Offline writing mode',
    details: 'Write without a connection.',
    status: 'planned',
    votes: 42,
    createdAt: '2026-07-22T12:00:00.000Z',
  },
  {
    id: 2,
    title: 'Mood calendar',
    details: 'Show patterns by month.',
    status: 'open',
    votes: 12,
    createdAt: '2026-07-23T12:00:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installSuccessfulApi() {
  authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/feature-requests' && options?.method === 'POST') {
      return jsonResponse({
        id: 3,
        title: 'Journal map',
        details: 'Connect related journal ideas.',
        status: 'open',
        votes: 1,
        createdAt: '2026-07-24T12:00:00.000Z',
      }, 201);
    }
    if (url === '/api/feature-requests/2/vote') {
      return jsonResponse({ requestId: 2, votes: 13, voted: true }, 201);
    }
    if (url === '/api/feature-requests/votes') {
      return jsonResponse({ requestIds: [1] });
    }
    return jsonResponse({ requests: REQUESTS });
  });
}

function t(key: string, params?: Record<string, string | number>) {
  const message = messages[key] ?? key;
  return Object.entries(params ?? {}).reduce(
    (current, [paramKey, value]) => current.replace(`{${paramKey}}`, String(value)),
    message,
  );
}

function renderPage(overrides: { onBackHome?: () => void; onSignIn?: () => void } = {}) {
  return render(
    <FeedbackPage
      t={t}
      theme="dark"
      onBackHome={overrides.onBackHome ?? vi.fn()}
      onSignIn={overrides.onSignIn ?? vi.fn()}
    />,
  );
}

describe('FeedbackPage', () => {
  beforeEach(() => {
    authFetch.mockReset();
    authState.isAuthenticated = true;
    installSuccessfulApi();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('loads persisted ideas and restores the current user vote state', async () => {
    renderPage();

    expect(screen.getByText('Loading community ideas...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Offline writing mode' }))
      .toBeInTheDocument();
    const votedRequest = screen.getByRole('heading', { name: 'Offline writing mode' })
      .closest('article');
    expect(votedRequest).not.toBeNull();
    expect(within(votedRequest as HTMLElement).getByRole('button')).toBeDisabled();
    expect(within(votedRequest as HTMLElement).getByText('Voted')).toBeInTheDocument();
  });

  it('submits a persisted idea with an automatic first vote', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Mood calendar' });

    await user.type(screen.getByLabelText('Idea title'), 'Journal map');
    await user.type(
      screen.getByLabelText('What would this improve?'),
      'Connect related journal ideas.',
    );
    await user.click(screen.getByRole('button', { name: 'Post idea' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your idea has been added.');
    expect(screen.getByRole('heading', { name: 'Journal map' })).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledWith(
      '/api/feature-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Journal map',
          details: 'Connect related journal ideas.',
        }),
      }),
    );
  });

  it('records one vote and uses the authoritative server count', async () => {
    const user = userEvent.setup();
    renderPage();
    const voteButton = await screen.findByRole('button', { name: 'Vote for Mood calendar' });

    await user.click(voteButton);

    await waitFor(() => expect(voteButton).toBeDisabled());
    expect(voteButton).toHaveTextContent('13');
    expect(voteButton).toHaveTextContent('Voted');
  });

  it('routes signed-out submit and vote actions to sign in', async () => {
    authState.isAuthenticated = false;
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    renderPage({ onSignIn });
    await screen.findByRole('heading', { name: 'Mood calendar' });

    await user.click(screen.getByRole('button', { name: 'Sign in to post' }));
    await user.click(screen.getByRole('button', { name: 'Sign in to vote for Mood calendar' }));

    expect(onSignIn).toHaveBeenCalledTimes(2);
    expect(authFetch).not.toHaveBeenCalledWith('/api/feature-requests/votes');
  });

  it('shows independent board and action failures', async () => {
    authFetch.mockRejectedValueOnce(new Error('offline'));
    const { unmount } = renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Board unavailable');
    unmount();

    installSuccessfulApi();
    authFetch.mockImplementationOnce(async () => jsonResponse({ requests: REQUESTS }));
    authFetch.mockImplementationOnce(async () => jsonResponse({ requestIds: [] }));
    authFetch.mockImplementationOnce(async () => jsonResponse({ message: 'nope' }, 500));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Mood calendar' });
    await user.click(screen.getByRole('button', { name: 'Vote for Mood calendar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vote failed');
  });

  it('navigates back home from the hero action', async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    renderPage({ onBackHome });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
