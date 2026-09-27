import { useState } from 'react';

import type { LikeState, ServiceResult } from '../../services/api';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface LikeButtonProps {
  readonly liked: boolean;
  readonly likeCount: number;
  /** Own entries and comments show their count but cannot be liked. */
  readonly canLike: boolean;
  /** Names the liked item for screen readers, e.g. "Like the entry by Maya". */
  readonly label: string;
  readonly onChange: (like: boolean) => Promise<ServiceResult<LikeState>>;
  readonly t: Translate;
}

function LikeButton({ liked: initialLiked, likeCount: initialCount, canLike, label, onChange, t }: LikeButtonProps) {
  const [state, setState] = useState({ liked: initialLiked, likeCount: initialCount });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!canLike) {
    return (
      <span className="feed-like own" title={t('likes')}>
        <span className="codicon codicon-heart" aria-hidden="true" />
        {state.likeCount}
        <span className="sr-only"> {t('likes')}</span>
      </span>
    );
  }

  const toggle = async () => {
    setPending(true);
    setFailed(false);
    const result = await onChange(!state.liked);
    setPending(false);
    if (result.data) setState(result.data);
    else setFailed(true);
  };

  return (
    <>
      <button
        type="button"
        className={`feed-like ${state.liked ? 'liked' : ''}`}
        aria-pressed={state.liked}
        aria-label={`${label}, ${t('likesCount', { count: state.likeCount })}`}
        disabled={pending}
        onClick={() => void toggle()}
      >
        <span className={`codicon ${state.liked ? 'codicon-heart-filled' : 'codicon-heart'}`} aria-hidden="true" />
        {state.likeCount}
      </button>
      {failed && <span className="feed-like-error" role="alert">{t('likeUpdateError')}</span>}
    </>
  );
}

export default LikeButton;
