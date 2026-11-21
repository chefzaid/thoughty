import { useState } from 'react';

import type { TranslationFunction } from '../../types';

interface MemoirSimpleModeCardProps {
  /** Whether signing in and the weekly email open the simple screen. */
  readonly enabled: boolean;
  /** Saves the setting; false when it could not be saved (the app's notice says so). */
  readonly onChange: (enabled: boolean) => Promise<boolean>;
  readonly onOpen: () => void;
  readonly t: TranslationFunction;
}

/** Simple mode on the Memoir page: open the simple screen now, or make it where the writer lands. */
function MemoirSimpleModeCard({ enabled, onChange, onOpen, t }: MemoirSimpleModeCardProps) {
  // The box shows the choice at once, while it saves; a refused save puts the saved setting back
  const [pending, setPending] = useState<boolean | null>(null);

  const toggle = async (next: boolean) => {
    setPending(next);
    await onChange(next);
    setPending(null);
  };

  return (
    <section className="memoir-card" aria-labelledby="memoir-simple-heading">
      <h2 id="memoir-simple-heading">{t('memoirSimpleModeTitle')}</h2>
      <p id="memoir-simple-description" className="memoir-hint">{t('memoirSimpleModeDescription')}</p>
      <div className="memoir-form memoir-simple-mode">
        <label className="memoir-checkbox" htmlFor="memoir-simple-mode">
          <input
            id="memoir-simple-mode"
            type="checkbox"
            checked={pending ?? enabled}
            disabled={pending !== null}
            aria-describedby="memoir-simple-description"
            onChange={(event) => void toggle(event.target.checked)}
          />
          {t('memoirSimpleModeSetting')}
        </label>
        <div className="memoir-actions">
          <button type="button" className="memoir-secondary" onClick={onOpen}>
            <span className="codicon codicon-screen-full" aria-hidden="true" />
            {t('memoirSimpleModeOpen')}
          </button>
        </div>
      </div>
    </section>
  );
}

export default MemoirSimpleModeCard;
