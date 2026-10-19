import { useState, type FormEvent } from 'react';

import { useTransientMessage } from '../../hooks/useTransientMessage';
import type { MemoirProgram, UpdateMemoirRequest } from '../../services/api';
import type { Diary, TranslationFunction } from '../../types';
import AutoDismiss from '../AutoDismiss/AutoDismiss';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import MemoirScheduleFields from './MemoirScheduleFields';
import { browserTimeZone, type MemoirLanguage } from './memoirFormat';

interface MemoirSettingsProps {
  readonly program: MemoirProgram;
  readonly diaries: readonly Diary[];
  readonly language: MemoirLanguage;
  readonly theme: 'light' | 'dark';
  readonly onUpdate: (request: UpdateMemoirRequest) => Promise<boolean>;
  readonly onLeave: () => Promise<boolean>;
  readonly t: TranslationFunction;
}

function MemoirSettings({ program, diaries, language, theme, onUpdate, onLeave, t }: MemoirSettingsProps) {
  const timeZone = browserTimeZone();
  const [weekday, setWeekday] = useState(program.deliveryWeekday);
  const [emailEnabled, setEmailEnabled] = useState(program.emailEnabled);
  const [diaryId, setDiaryId] = useState(program.diaryId ? String(program.diaryId) : '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const saved = useTransientMessage();
  const paused = program.status === 'paused';

  const run = async (request: UpdateMemoirRequest, confirm: boolean) => {
    setBusy(true);
    setFailed(false);
    const ok = await onUpdate(request);
    setBusy(false);
    setFailed(!ok);
    if (ok && confirm) saved.show();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run({
      deliveryWeekday: weekday,
      emailEnabled,
      timeZone,
      ...(diaryId ? { diaryId: Number(diaryId) } : {}),
    }, true);
  };

  const handleLeave = async () => {
    setConfirmingLeave(false);
    setBusy(true);
    const left = await onLeave();
    setBusy(false);
    setFailed(!left);
  };

  return (
    <section className="memoir-card memoir-settings" aria-labelledby="memoir-settings-heading">
      <h2 id="memoir-settings-heading">{t('memoirSettings')}</h2>
      <form className="memoir-form" onSubmit={handleSubmit}>
        <div className="memoir-field">
          <label htmlFor="memoir-settings-diary">{t('memoirDiaryLabel')}</label>
          <select id="memoir-settings-diary" value={diaryId} required onChange={(event) => setDiaryId(event.target.value)}>
            {!diaryId && <option value="" disabled>—</option>}
            {diaries.map((diary) => (
              <option key={diary.id} value={diary.id}>{`${diary.icon} ${diary.name}`}</option>
            ))}
          </select>
        </div>
        <MemoirScheduleFields
          idPrefix="memoir-settings"
          weekday={weekday}
          emailEnabled={emailEnabled}
          timeZone={timeZone}
          language={language}
          onWeekdayChange={setWeekday}
          onEmailEnabledChange={setEmailEnabled}
          t={t}
        />
        <div className="memoir-actions">
          <button type="submit" className="memoir-primary" disabled={busy || !diaryId}>
            <span className="codicon codicon-save" aria-hidden="true" />
            {t('memoirSaveSettings')}
          </button>
          <button type="button" className="memoir-secondary" disabled={busy} onClick={() => void run({ status: paused ? 'active' : 'paused' }, false)}>
            <span className={`codicon codicon-${paused ? 'debug-start' : 'debug-pause'}`} aria-hidden="true" />
            {paused ? t('memoirResume') : t('memoirPause')}
          </button>
          <button type="button" className="memoir-danger" disabled={busy} onClick={() => setConfirmingLeave(true)}>
            <span className="codicon codicon-close" aria-hidden="true" />
            {t('memoirLeave')}
          </button>
        </div>
        <AutoDismiss message={saved} durationMs={3000}>
          <p className="memoir-success" role="status">{t('memoirSettingsSaved')}</p>
        </AutoDismiss>
        {failed && <p className="memoir-error" role="alert">{t('memoirSaveError')}</p>}
      </form>
      <ConfirmModal
        isOpen={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        onConfirm={() => void handleLeave()}
        title={t('memoirLeaveTitle')}
        message={t('memoirLeaveMessage')}
        confirmLabel={t('memoirLeave')}
        theme={theme}
        t={t}
      />
    </section>
  );
}

export default MemoirSettings;
