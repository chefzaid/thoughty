import { useEffect, useId, useState, type FormEvent } from 'react';

import type { PublicFeedFilters } from '../../services/api';
import './FeedTopicBar.css';

interface FeedTopicBarProps {
  /** The topic (a tag) and the word search narrowing the feed, as in the address. */
  readonly filters: PublicFeedFilters;
  readonly onChange: (filters: PublicFeedFilters) => void;
  /** Following the open topic, when the page can follow topics. */
  readonly topicFollow?: {
    readonly followed: boolean;
    readonly pending: boolean;
    readonly onToggle: () => void;
  };
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The feed's word search, and the open topic with **Follow the topic** and a way back to every topic; or, on the one
 * entry a notification leads to, a way to the whole feed.
 */
function FeedTopicBar({ filters, onChange, topicFollow, t }: FeedTopicBarProps) {
  if (filters.entry) {
    return (
      <div className="feed-topic-bar">
        <section className="feed-topic feed-one-entry" aria-label={t('feedOneEntry')}>
          <p>{t('feedOneEntry')}</p>
          <button type="button" className="feed-whole-feed" onClick={() => onChange({})}>
            <span className="codicon codicon-arrow-left" aria-hidden="true" />
            {t('feedShowWholeFeed')}
          </button>
        </section>
      </div>
    );
  }
  return <FeedSearchAndTopic filters={filters} onChange={onChange} topicFollow={topicFollow} t={t} />;
}

function FeedSearchAndTopic({ filters, onChange, topicFollow, t }: FeedTopicBarProps) {
  const { tag, search } = filters;
  const [draft, setDraft] = useState(search ?? '');
  const headingId = useId();

  // The address can change the search too (going back, or opening a topic)
  useEffect(() => setDraft(search ?? ''), [search]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChange({ tag, search: draft.trim() || undefined });
  };

  return (
    <div className="feed-topic-bar">
      <form className="feed-search" role="search" onSubmit={submit}>
        <span className="codicon codicon-search" aria-hidden="true" />
        <input
          type="search"
          value={draft}
          maxLength={500}
          placeholder={t('feedSearchPlaceholder')}
          aria-label={t('feedSearchLabel')}
          onChange={(event) => setDraft(event.target.value)}
        />
        {search && (
          <button
            type="button"
            className="feed-search-clear"
            aria-label={t('feedSearchClear')}
            title={t('feedSearchClear')}
            onClick={() => onChange({ tag })}
          >
            <span className="codicon codicon-close" aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="feed-search-submit">{t('feedSearchSubmit')}</button>
      </form>
      {tag && (
        <section className="feed-topic" aria-labelledby={headingId}>
          <div>
            <p className="feed-topic-label">{t('feedTopicHeading')}</p>
            <h2 id={headingId}>#{tag}</h2>
          </div>
          {topicFollow && (
            <button
              type="button"
              className={`feed-follow${topicFollow.followed ? ' followed' : ''}`}
              aria-pressed={topicFollow.followed}
              disabled={topicFollow.pending}
              onClick={topicFollow.onToggle}
            >
              <span className={`codicon codicon-${topicFollow.followed ? 'check' : 'add'}`} aria-hidden="true" />
              {t(topicFollow.followed ? 'followingTopic' : 'followTopic')}
              <span className="sr-only"> #{tag}</span>
            </button>
          )}
          <button
            type="button"
            className="feed-topic-close"
            aria-label={t('feedCloseTopic')}
            title={t('feedCloseTopic')}
            onClick={() => onChange({ search })}
          >
            <span className="codicon codicon-close" aria-hidden="true" />
          </button>
        </section>
      )}
    </div>
  );
}

export default FeedTopicBar;
