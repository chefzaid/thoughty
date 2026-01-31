import React, { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';
import { getDefaultBirthday } from './types';

interface PersonalSectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  setLocalConfig: Dispatch<SetStateAction<ProfileConfig>>;
  isDark: boolean;
  t: TranslationFunction;
}

const PersonalSection: React.FC<PersonalSectionProps> = ({ localConfig, handleChange, setLocalConfig, isDark, t }) => (
  <div className="profile-section">
    <div className="section-header">
      <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <h3 className="section-title">{t('personalInfo')}</h3>
    </div>
    <div className="section-content">
      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label">{t('fullName')}</label>
          <span className="setting-description">{t('fullNameDescription')}</span>
        </div>
        <input
          type="text"
          name="name"
          value={localConfig.name || ''}
          onChange={handleChange}
          placeholder={t('enterYourFullName')}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label">{t('bio')}</label>
          <span className="setting-description">{t('bioDescription')}</span>
        </div>
        <textarea
          name="bio"
          value={localConfig.bio || ''}
          onChange={handleChange}
          placeholder={t('writeSomethingAboutYourself')}
          className={`setting-textarea ${isDark ? 'dark' : 'light'}`}
          rows={3}
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label">{t('email')}</label>
          <span className="setting-description">{t('emailDescription')}</span>
        </div>
        <input
          type="email"
          name="email"
          value={localConfig.email || ''}
          onChange={handleChange}
          placeholder={t('enterYourEmail')}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
          disabled
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label">{t('birthday')}</label>
          <span className="setting-description">{t('birthdayDescription')}</span>
        </div>
        <input
          type="date"
          name="birthday"
          value={localConfig.birthday || ''}
          onChange={handleChange}
          onFocus={() => {
            if (!localConfig.birthday) {
              setLocalConfig((prev) => ({ ...prev, birthday: getDefaultBirthday() }));
            }
          }}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
        />
      </div>
    </div>
  </div>
);

export default PersonalSection;
