import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import {
  createFeatureRequestsService,
  type FeatureRequest,
} from '../../services/api/featureRequestsService';
import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './FeedbackPage.css';

interface FeedbackPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
  readonly onSignIn: () => void;
}

interface FeedbackIdea extends FeatureRequest {
  voted: boolean;
}

const STATUS_KEYS = {
  open: 'feedbackStatusOpen',
  reviewing: 'feedbackStatusReviewing',
  planned: 'feedbackStatusPlanned',
} as const;

function sortIdeas(ideas: FeedbackIdea[]): FeedbackIdea[] {
  return [...ideas].sort(
    (left, right) =>
      right.votes - left.votes || right.createdAt.localeCompare(left.createdAt),
  );
}

function FeedbackPage({
  theme,
  t,
  onBackHome,
  onSignIn,
}: Readonly<FeedbackPageProps>) {
  const { authFetch, isAuthenticated } = useAuth();
  const featureRequestsService = useMemo(
    () => createFeatureRequestsService(authFetch),
    [authFetch],
  );
  const [ideas, setIdeas] = useState<FeedbackIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<number | null>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    let active = true;

    const loadBoard = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [requests, votedRequestIds] = await Promise.all([
          featureRequestsService.list(),
          isAuthenticated
            ? featureRequestsService.getVotedRequestIds()
            : Promise.resolve([]),
        ]);
        if (!active) return;

        const votedIds = new Set(votedRequestIds);
        setIdeas(
          requests.map((request) => ({
            ...request,
            voted: votedIds.has(request.id),
          })),
        );
      } catch (error) {
        console.error('Error loading feature requests:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadBoard();
    return () => {
      active = false;
    };
  }, [featureRequestsService, isAuthenticated]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated) {
      onSignIn();
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const details = String(formData.get('body') ?? '').trim();

    if (!title || !details) {
      return;
    }

    setSubmitting(true);
    setSubmitted(false);
    setActionError(null);
    try {
      const request = await featureRequestsService.create({ title, details });
      setIdeas((currentIdeas) =>
        sortIdeas([{ ...request, voted: true }, ...currentIdeas]),
      );
      setSubmitted(true);
      form.reset();
    } catch (error) {
      console.error('Error submitting feature request:', error);
      setActionError(t('feedbackSubmitError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(idea: FeedbackIdea) {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    if (idea.voted) return;

    setVotingId(idea.id);
    setActionError(null);
    try {
      const result = await featureRequestsService.vote(idea.id);
      setIdeas((currentIdeas) =>
        sortIdeas(
          currentIdeas.map((currentIdea) =>
            currentIdea.id === idea.id
              ? { ...currentIdea, votes: result.votes, voted: true }
              : currentIdea,
          ),
        ),
      );
    } catch (error) {
      console.error('Error voting for feature request:', error);
      setActionError(t('feedbackVoteError'));
    } finally {
      setVotingId(null);
    }
  }

  return (
    <div className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <main className="feedback-page">
        <section className="feedback-hero">
          <div className="feedback-copy">
            <p className="intro-eyebrow">{t('feedbackEyebrow')}</p>
            <h1>{t('feedbackTitle')}</h1>
            <p>{t('feedbackSubtitle')}</p>
            <button type="button" className="intro-btn secondary" onClick={onBackHome}>
              {t('back')}
            </button>
          </div>

          <form className="feedback-form" onSubmit={handleSubmit}>
            <h2>{t('feedbackFormTitle')}</h2>
            <label>
              <span>{t('feedbackTitleLabel')}</span>
              <input name="title" required />
            </label>
            <label>
              <span>{t('feedbackDetailsLabel')}</span>
              <textarea name="body" rows={5} required />
            </label>
            <button
              type={isAuthenticated ? 'submit' : 'button'}
              className="intro-btn primary"
              disabled={submitting}
              onClick={isAuthenticated ? undefined : onSignIn}
            >
              {isAuthenticated ? t('feedbackSubmit') : t('feedbackSignInToSubmit')}
            </button>
            {submitted ? (
              <p className="feedback-success" role="status">
                {t('feedbackSuccess')}
              </p>
            ) : null}
            {actionError ? (
              <p className="feedback-error" role="alert">
                {actionError}
              </p>
            ) : null}
          </form>
        </section>

        <section className="landing-section feedback-board">
          <div className="section-heading">
            <p className="section-kicker">{t('feedbackBoardKicker')}</p>
            <h2>{t('feedbackBoardTitle')}</h2>
          </div>
          <div className="feedback-ideas" aria-label={t('feedbackBoardTitle')}>
            {loading ? (
              <p className="feedback-board-message" role="status">
                {t('feedbackLoading')}
              </p>
            ) : null}
            {!loading && loadError ? (
              <p className="feedback-board-message error" role="alert">
                {t('feedbackLoadError')}
              </p>
            ) : null}
            {!loading && !loadError && ideas.length === 0 ? (
              <p className="feedback-board-message">{t('feedbackEmpty')}</p>
            ) : null}
            {!loading && !loadError ? ideas.map((idea) => (
              <article className="feedback-idea" key={idea.id}>
                <div>
                  <span className="feedback-status">{t(STATUS_KEYS[idea.status])}</span>
                  <h3>{idea.title}</h3>
                  <p>{idea.details}</p>
                </div>
                <button
                  type="button"
                  className="feedback-vote"
                  onClick={() => handleVote(idea)}
                  disabled={idea.voted || votingId === idea.id}
                  aria-label={
                    isAuthenticated
                      ? t('feedbackVoteAria', { title: idea.title })
                      : t('feedbackSignInToVote', { title: idea.title })
                  }
                >
                  <span>{idea.votes}</span>
                  <strong>{idea.voted ? t('feedbackVoted') : t('feedbackVote')}</strong>
                </button>
              </article>
            )) : null}
          </div>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default FeedbackPage;
