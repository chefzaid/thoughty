import type { TranslationFunction } from './types';

interface ProfileActionsProps {
  onBack: () => void;
  handleSave: () => void;
  t: TranslationFunction;
}

function ProfileActions({ onBack, handleSave, t }: Readonly<ProfileActionsProps>) {
  return (
  <div className="profile-actions">
    <button type="button" onClick={onBack} className="btn-cancel">
      {t('cancel')}
    </button>
    <button type="button" onClick={handleSave} className="btn-save">
      {t('saveSettings')}
    </button>
  </div>
  );
}

export default ProfileActions;
