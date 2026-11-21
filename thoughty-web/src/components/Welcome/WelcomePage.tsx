import { useState } from 'react';

import type { Diary, TranslationFunction } from '../../types';
import { getEntryTemplates } from '../../utils/entryTemplates';
import PageHeader from '../PageHeader/PageHeader';
import './WelcomePage.css';

/** The built-in templates offered to a new daily journal, in this order. */
const FIRST_TEMPLATE_IDS = ['builtin-daily-reflection', 'builtin-gratitude', 'builtin-morning-intentions'] as const;
const FIRST_TEMPLATES = FIRST_TEMPLATE_IDS.flatMap((id) => getEntryTemplates().filter((template) => template.id === id));
const BLANK = '';

export interface WelcomePageProps {
  readonly theme?: 'light' | 'dark';
  readonly diaries: readonly Diary[];
  /** Marks the welcome page as done; resolves false when the save failed (the app says so). */
  readonly onFinish: () => Promise<boolean>;
  /** Makes the template the diary's default template; rejects with an error code when the save fails. */
  readonly onSetDiaryTemplate: (diary: Diary, templateId: string) => Promise<void>;
  readonly onOpenJournal: () => void;
  readonly onOpenMemoir: () => void;
  readonly onOpenImport: () => void;
  readonly t: TranslationFunction;
}

/**
 * First-run onboarding: asks a new account what it is here for and lands it in the right place, the
 * journal with a first template, the memoir start page or the importers. Any way out marks it done.
 */
function WelcomePage({ theme = 'dark', diaries, onFinish, onSetDiaryTemplate, onOpenJournal, onOpenMemoir, onOpenImport, t }: WelcomePageProps) {
  const defaultDiary = diaries.find((diary) => diary.isDefault);
  const [step, setStep] = useState<'choose' | 'template'>('choose');
  const [templateId, setTemplateId] = useState<string>(FIRST_TEMPLATE_IDS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishThen = async (open: () => void, beforeFinish?: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await beforeFinish?.();
      if (await onFinish()) {
        open();
        return;
      }
    } catch (failure) {
      setError((failure as Error).message || 'diaryUpdateFailed');
    }
    setBusy(false);
  };

  const startWriting = () => finishThen(
    onOpenJournal,
    defaultDiary && templateId !== BLANK ? () => onSetDiaryTemplate(defaultDiary, templateId) : undefined,
  );

  // Without a default diary there is nothing to give a template to, so the journal opens as it is
  const chooseJournal = () => (defaultDiary ? setStep('template') : void finishThen(onOpenJournal));

  return (
    <section className={`welcome-page ${theme}`} aria-labelledby="welcome-heading">
      <PageHeader title={t('welcomeTitle')} titleId="welcome-heading" subtitle={t('welcomeSubtitle')} theme={theme} />

      {step === 'choose' ? (
        <>
          <ul className="welcome-choices" aria-label={t('welcomeChoicesLabel')}>
            <li>
              <button type="button" className="welcome-choice" onClick={chooseJournal} disabled={busy}>
                <span className="codicon codicon-book" aria-hidden="true" />
                <span className="welcome-choice-title">{t('welcomeJournalTitle')}</span>
                <span className="welcome-choice-body">{t('welcomeJournalBody')}</span>
              </button>
            </li>
            <li>
              <button type="button" className="welcome-choice" onClick={() => void finishThen(onOpenMemoir)} disabled={busy}>
                <span className="codicon codicon-history" aria-hidden="true" />
                <span className="welcome-choice-title">{t('welcomeMemoirTitle')}</span>
                <span className="welcome-choice-body">{t('welcomeMemoirBody')}</span>
              </button>
            </li>
            <li>
              <button type="button" className="welcome-choice" onClick={() => void finishThen(onOpenImport)} disabled={busy}>
                <span className="codicon codicon-cloud-download" aria-hidden="true" />
                <span className="welcome-choice-title">{t('welcomeImportTitle')}</span>
                <span className="welcome-choice-body">{t('welcomeImportBody')}</span>
              </button>
            </li>
          </ul>
          <button type="button" className="welcome-skip" onClick={() => void finishThen(onOpenJournal)} disabled={busy}>
            {t('welcomeSkip')}
          </button>
        </>
      ) : (
        <form
          className="welcome-card"
          aria-labelledby="welcome-template-heading"
          onSubmit={(event) => {
            event.preventDefault();
            void startWriting();
          }}
        >
          <fieldset className="welcome-templates" disabled={busy}>
            <legend id="welcome-template-heading">{t('welcomeTemplateTitle')}</legend>
            <p className="welcome-hint">{t('welcomeTemplateHint', { diary: defaultDiary?.name ?? '' })}</p>
            {[...FIRST_TEMPLATES.map((template) => ({ id: template.id, name: template.name, body: template.content.split('\n')[0] })),
              { id: BLANK, name: t('welcomeTemplateBlank'), body: t('welcomeTemplateBlankBody') }].map((option) => (
              <label key={option.id || 'blank'} className="welcome-template">
                <input
                  type="radio"
                  name="welcome-template"
                  value={option.id}
                  checked={templateId === option.id}
                  onChange={() => setTemplateId(option.id)}
                />
                <span className="welcome-template-text">
                  <span className="welcome-choice-title">{option.name}</span>
                  <span className="welcome-choice-body">{option.body}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p className="welcome-error" role="alert">{t(error)}</p>}
          <div className="welcome-actions">
            <button type="submit" className="welcome-primary" disabled={busy}>
              {busy ? t('welcomeSaving') : t('welcomeStartWriting')}
            </button>
            <button type="button" className="welcome-secondary" onClick={() => setStep('choose')} disabled={busy}>
              {t('welcomeTemplateBack')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default WelcomePage;
