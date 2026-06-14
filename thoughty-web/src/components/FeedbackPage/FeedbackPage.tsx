import { FormEvent, useState } from 'react';

import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './FeedbackPage.css';

interface FeedbackPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
}

interface FeedbackIdea {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly statusKey: string;
  votes: number;
  voted: boolean;
}

const INITIAL_IDEAS: FeedbackIdea[] = [
  {
    id: 'offline-mode',
    title: 'feedbackIdeaOfflineTitle',
    body: 'feedbackIdeaOfflineBody',
    statusKey: 'feedbackStatusPlanned',
    votes: 42,
    voted: false,
  },
  {
    id: 'writing-prompts',
    title: 'feedbackIdeaPromptsTitle',
    body: 'feedbackIdeaPromptsBody',
    statusKey: 'feedbackStatusReviewing',
    votes: 28,
    voted: false,
  },
  {
    id: 'shared-collections',
    title: 'feedbackIdeaSharingTitle',
    body: 'feedbackIdeaSharingBody',
    statusKey: 'feedbackStatusOpen',
    votes: 17,
    voted: false,
  },
];

function FeedbackPage({ theme, t, onBackHome }: Readonly<FeedbackPageProps>) {
  const [ideas, setIdeas] = useState(INITIAL_IDEAS);
  const [submitted, setSubmitted] = useState(false);
  const isLight = theme === 'light';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();

    if (!title || !body) {
      return;
    }

    setIdeas((currentIdeas) => [
      {
        id: `local-${Date.now()}`,
        title,
        body,
        statusKey: 'feedbackStatusOpen',
        votes: 1,
        voted: true,
      },
      ...currentIdeas,
    ]);
    setSubmitted(true);
    event.currentTarget.reset();
  }

  function handleVote(ideaId: string) {
    setIdeas((currentIdeas) => currentIdeas.map((idea) => {
      if (idea.id !== ideaId || idea.voted) {
        return idea;
      }

      return {
        ...idea,
        votes: idea.votes + 1,
        voted: true,
      };
    }));
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
            <button type="submit" className="intro-btn primary">
              {t('feedbackSubmit')}
            </button>
            {submitted ? (
              <p className="feedback-success" role="status">
                {t('feedbackSuccess')}
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
            {ideas.map((idea) => (
              <article className="feedback-idea" key={idea.id}>
                <div>
                  <span className="feedback-status">{t(idea.statusKey)}</span>
                  <h3>{t(idea.title)}</h3>
                  <p>{t(idea.body)}</p>
                </div>
                <button
                  type="button"
                  className="feedback-vote"
                  onClick={() => handleVote(idea.id)}
                  disabled={idea.voted}
                  aria-label={t('feedbackVoteAria', { title: t(idea.title) })}
                >
                  <span>{idea.votes}</span>
                  <strong>{idea.voted ? t('feedbackVoted') : t('feedbackVote')}</strong>
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default FeedbackPage;
