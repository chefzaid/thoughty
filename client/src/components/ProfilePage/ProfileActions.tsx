import React from 'react';
import type { TranslationFunction } from './types';

interface ProfileActionsProps {
  onBack: () => void;
  handleSave: () => void;
  t: TranslationFunction;
}

const ProfileActions: React.FC<ProfileActionsProps> = ({ onBack, handleSave, t }) => (
  <div className="profile-actions">
    <button onClick={onBack} className="btn-cancel">
      {t('cancel')}
    </button>
    <button onClick={handleSave} className="btn-save">
      {t('saveSettings')}
    </button>
  </div>
);

export default ProfileActions;
