import type { Diary, TranslationFunction } from '../../types';
import { createYearReviewEmailService } from '../../services/api';
import type { Language } from '../../utils/translations';
import OptInEmailSection, { type OptInEmailCopyKeys } from '../OptInEmail/OptInEmailSection';

const YEAR_REVIEW_EMAIL_QUERY_KEY = ['yearReviewEmail'] as const;

const COPY: OptInEmailCopyKeys = {
  title: 'yearReviewEmailTitle',
  intro: 'yearReviewEmailIntro',
  enable: 'yearReviewEmailEnable',
  enableDescription: 'yearReviewEmailEnableDescription',
  next: 'yearReviewEmailNext',
  privacy: 'yearReviewEmailPrivacy',
  turnedOn: 'yearReviewEmailTurnedOn',
  turnedOff: 'yearReviewEmailTurnedOff',
  saved: 'yearReviewEmailSaved',
  loadFailed: 'yearReviewEmailLoadFailed',
  saveFailed: 'yearReviewEmailSaveFailed',
};

interface YearReviewEmailSectionProps {
  readonly diaries: readonly Diary[];
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** The profile's opt-in year in review email: on January 1, at the chosen local hour, about the year just ended. */
function YearReviewEmailSection(props: YearReviewEmailSectionProps) {
  return (
    <OptInEmailSection
      {...props}
      sectionId="year-review-email"
      switchName="yearReviewEmail"
      queryKey={YEAR_REVIEW_EMAIL_QUERY_KEY}
      createService={createYearReviewEmailService}
      copy={COPY}
    />
  );
}

export default YearReviewEmailSection;
