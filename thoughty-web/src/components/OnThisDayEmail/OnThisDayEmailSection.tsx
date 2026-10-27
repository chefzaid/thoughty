import type { Diary, TranslationFunction } from '../../types';
import { createOnThisDayEmailService } from '../../services/api';
import type { Language } from '../../utils/translations';
import OptInEmailSection, { type OptInEmailCopyKeys } from '../OptInEmail/OptInEmailSection';

const ON_THIS_DAY_EMAIL_QUERY_KEY = ['onThisDayEmail'] as const;

const COPY: OptInEmailCopyKeys = {
  title: 'onThisDayEmailTitle',
  intro: 'onThisDayEmailIntro',
  enable: 'onThisDayEmailEnable',
  enableDescription: 'onThisDayEmailEnableDescription',
  next: 'onThisDayEmailNext',
  privacy: 'onThisDayEmailPrivacy',
  turnedOn: 'onThisDayEmailTurnedOn',
  turnedOff: 'onThisDayEmailTurnedOff',
  saved: 'onThisDayEmailSaved',
  loadFailed: 'onThisDayEmailLoadFailed',
  saveFailed: 'onThisDayEmailSaveFailed',
};

interface OnThisDayEmailSectionProps {
  readonly diaries: readonly Diary[];
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** The profile's opt-in "On this day" email: on days with entries from earlier years, at the chosen local hour. */
function OnThisDayEmailSection(props: OnThisDayEmailSectionProps) {
  return (
    <OptInEmailSection
      {...props}
      sectionId="on-this-day-email"
      switchName="onThisDayEmail"
      queryKey={ON_THIS_DAY_EMAIL_QUERY_KEY}
      createService={createOnThisDayEmailService}
      copy={COPY}
    />
  );
}

export default OnThisDayEmailSection;
