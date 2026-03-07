import React from 'react';
import type { TranslationFunction } from './types';

interface ProfilePageHeaderProps {
  onBack: () => void;
  isDark: boolean;
  t: TranslationFunction;
}

const ProfilePageHeader: React.FC<ProfilePageHeaderProps> = ({ onBack, isDark, t }) => (
  <div className="profile-page-header">
    <button onClick={onBack} className={`back-btn ${isDark ? 'dark' : 'light'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      {t('back')}
    </button>
    <h1 className="profile-page-title">{t('profile')}</h1>
  </div>
);

export default ProfilePageHeader;
