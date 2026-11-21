import { useState } from 'react';

import type { SavedState, ServiceResult } from '../../services/api';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface SaveButtonProps {
  readonly saved: boolean;
  /** Names the entry for screen readers, e.g. "Save the entry by Maya". */
  readonly label: string;
  readonly onChange: (save: boolean) => Promise<ServiceResult<SavedState>>;
  readonly t: Translate;
}

/** Adds another writer's entry to the reader's private Saved list, or takes it out; nobody else is told. */
function SaveButton({ saved: initialSaved, label, onChange, t }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    setPending(true);
    setFailed(false);
    const result = await onChange(!saved);
    setPending(false);
    if (result.data) setSaved(result.data.saved);
    else setFailed(true);
  };

  return (
    <>
      <button
        type="button"
        className={`feed-entry-action feed-save${saved ? ' saved' : ''}`}
        aria-pressed={saved}
        aria-label={label}
        disabled={pending}
        onClick={() => void toggle()}
      >
        <span className="codicon codicon-bookmark" aria-hidden="true" />
        {t(saved ? 'savedEntry' : 'saveEntry')}
      </button>
      {failed && <span className="feed-like-error" role="alert">{t('saveUpdateError')}</span>}
    </>
  );
}

export default SaveButton;
