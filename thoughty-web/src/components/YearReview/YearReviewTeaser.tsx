import type { TranslationFunction } from '../../types';
import { useQuietMode } from '../QuietMode/quietMode';
import './YearReviewTeaser.css';

interface YearReviewTeaserProps {
  readonly theme?: 'light' | 'dark';
  readonly onOpen: () => void;
  readonly t: TranslationFunction;
}

/** Invitation from the stats page to the year in review. */
function YearReviewTeaser({ theme, onOpen, t }: YearReviewTeaserProps) {
  // Quiet mode's review has no totals, so the invitation does not promise them
  const quiet = useQuietMode();
  return (
    <section className={`review-teaser ${theme === 'light' ? 'light' : 'dark'}`} aria-labelledby="review-teaser-heading">
      <div>
        <h2 id="review-teaser-heading">{t('reviewTeaserTitle')}</h2>
        <p>{t(quiet ? 'quietModeReviewTeaserBody' : 'reviewTeaserBody')}</p>
      </div>
      <button type="button" onClick={onOpen}>{t('reviewTeaserAction')}</button>
    </section>
  );
}

export default YearReviewTeaser;
