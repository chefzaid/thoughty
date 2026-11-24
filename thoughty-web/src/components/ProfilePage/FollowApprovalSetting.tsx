import { useEffect, useState } from 'react';

import { useFeedService } from '../../hooks/useFeedService';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import SettingSwitch from './SettingSwitch';
import type { TranslationFunction } from './types';

interface FollowApprovalSettingProps {
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

interface ApprovalState {
  readonly required: boolean;
  /** Requests still waiting, which turning it off approves. */
  readonly waiting: number;
}

/**
 * Followers by approval (Profile › Public entries): saved as soon as it is switched, apart from the Profile form.
 * Turning it off with requests still waiting asks first, since they are then approved.
 */
function FollowApprovalSetting({ isDark, language, t }: FollowApprovalSettingProps) {
  const feedService = useFeedService();
  const [state, setState] = useState<ApprovalState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void feedService
      .fetchFollows()
      .then(({ data }) => {
        if (!active) return;
        setState(
          data ? { required: data.approvalRequired, waiting: data.requests?.length ?? 0 } : null,
        );
        setLoadError(!data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [feedService]);

  const save = async (required: boolean) => {
    setConfirmingOff(false);
    setSaving(true);
    setSaveError(false);
    const { data } = await feedService.setFollowApproval(required);
    setSaving(false);
    if (!data) {
      setSaveError(true);
      return;
    }
    setState({ required: data.required, waiting: data.required ? state?.waiting ?? 0 : 0 });
    if (data.required) setNotice(t('followApprovalTurnedOn'));
    else if (data.approved > 0) setNotice(pluralPhrase(t, 'followApprovalApproved', data.approved, language));
    else setNotice(t('followApprovalTurnedOff'));
  };

  const toggle = () => {
    if (!state || saving) return;
    if (state.required && state.waiting > 0) setConfirmingOff(true);
    else void save(!state.required);
  };

  return (
    <>
      {state && (
        <SettingSwitch
          name="followersByApproval"
          label={t('followersByApproval')}
          description={t('followersByApprovalDescription')}
          enabled={state.required}
          handleChange={toggle}
        />
      )}
      {loadError && <div className="password-error" role="alert">{t('followApprovalLoadError')}</div>}
      {saveError && <div className="password-error" role="alert">{t('followApprovalSaveError')}</div>}
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      <ConfirmModal
        isOpen={confirmingOff}
        onClose={() => setConfirmingOff(false)}
        onConfirm={() => void save(false)}
        title={t('followApprovalOffTitle')}
        message={pluralPhrase(t, 'followApprovalOffMessage', state?.waiting ?? 0, language)}
        confirmLabel={t('followApprovalOffConfirm')}
        theme={isDark ? 'dark' : 'light'}
        t={t}
      />
    </>
  );
}

export default FollowApprovalSetting;
