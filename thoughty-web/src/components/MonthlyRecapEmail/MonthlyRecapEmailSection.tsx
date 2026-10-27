import type { Diary, TranslationFunction } from '../../types';
import { createMonthlyRecapEmailService } from '../../services/api';
import type { Language } from '../../utils/translations';
import OptInEmailSection, { type OptInEmailCopyKeys } from '../OptInEmail/OptInEmailSection';

const MONTHLY_RECAP_EMAIL_QUERY_KEY = ['monthlyRecapEmail'] as const;

const COPY: OptInEmailCopyKeys = {
  title: 'monthlyRecapEmailTitle',
  intro: 'monthlyRecapEmailIntro',
  enable: 'monthlyRecapEmailEnable',
  enableDescription: 'monthlyRecapEmailEnableDescription',
  next: 'monthlyRecapEmailNext',
  privacy: 'monthlyRecapEmailPrivacy',
  turnedOn: 'monthlyRecapEmailTurnedOn',
  turnedOff: 'monthlyRecapEmailTurnedOff',
  saved: 'monthlyRecapEmailSaved',
  loadFailed: 'monthlyRecapEmailLoadFailed',
  saveFailed: 'monthlyRecapEmailSaveFailed',
};

interface MonthlyRecapEmailSectionProps {
  readonly diaries: readonly Diary[];
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** The profile's opt-in monthly recap: on the 1st of each month, at the chosen local hour, about the month just ended. */
function MonthlyRecapEmailSection(props: MonthlyRecapEmailSectionProps) {
  return (
    <OptInEmailSection
      {...props}
      sectionId="monthly-recap-email"
      switchName="monthlyRecapEmail"
      queryKey={MONTHLY_RECAP_EMAIL_QUERY_KEY}
      createService={createMonthlyRecapEmailService}
      copy={COPY}
    />
  );
}

export default MonthlyRecapEmailSection;
