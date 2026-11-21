import { useId, type ChangeEvent } from 'react';

import type { CommentPolicy } from '../../services/api';
import { COMMENT_POLICY_OPTIONS } from './commentPolicyOptions';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface CommentPolicySelectProps {
  readonly value: CommentPolicy;
  readonly onChange: (policy: CommentPolicy) => void;
  readonly t: Translate;
}

/** On the reader's own entry: who may comment on it. */
function CommentPolicySelect({ value, onChange, t }: CommentPolicySelectProps) {
  const id = useId();
  return (
    <div className="feed-comment-policy">
      <label htmlFor={id}>{t('commentPolicyLabel')}</label>
      <select
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as CommentPolicy)}
      >
        {COMMENT_POLICY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{t(option.label)}</option>
        ))}
      </select>
    </div>
  );
}

export default CommentPolicySelect;
