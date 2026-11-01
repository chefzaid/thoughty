import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';
import { getDefaultBirthday } from './types';

interface PersonalSectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  setLocalConfig: Dispatch<SetStateAction<ProfileConfig>>;
  isDark: boolean;
  t: TranslationFunction;
}

function PersonalSection({ localConfig, handleChange, setLocalConfig, isDark, t }: Readonly<PersonalSectionProps>) {
  return (
  <div className="profile-section">
    <div className="section-header">
      <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <h2 className="section-title">{t('personalInfo')}</h2>
    </div>
    <div className="section-content">
      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-name">{t('fullName')}</label>
          <span id="profile-name-description" className="setting-description">{t('fullNameDescription')}</span>
        </div>
        <input
          type="text"
          id="profile-name"
          name="name"
          aria-describedby="profile-name-description"
          value={localConfig.name || ''}
          onChange={handleChange}
          placeholder={t('enterYourFullName')}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-bio">{t('bio')}</label>
          <span id="profile-bio-description" className="setting-description">{t('bioDescription')}</span>
        </div>
        <textarea
          id="profile-bio"
          name="bio"
          aria-describedby="profile-bio-description"
          value={localConfig.bio || ''}
          onChange={handleChange}
          placeholder={t('writeSomethingAboutYourself')}
          className={`setting-textarea ${isDark ? 'dark' : 'light'}`}
          rows={3}
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-email">{t('email')}</label>
          <span id="profile-email-description" className="setting-description">{t('emailDescription')}</span>
        </div>
        <input
          type="email"
          id="profile-email"
          name="email"
          aria-describedby="profile-email-description"
          value={localConfig.email || ''}
          onChange={handleChange}
          placeholder={t('enterYourEmail')}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
          disabled
        />
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-birthday">{t('birthday')}</label>
          <span id="profile-birthday-description" className="setting-description">{t('birthdayDescription')}</span>
        </div>
        <input
          type="date"
          id="profile-birthday"
          name="birthday"
          aria-describedby="profile-birthday-description"
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

      <div className="setting-row">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-gender">{t('gender')}</label>
          <span id="profile-gender-description" className="setting-description">{t('genderDescription')}</span>
        </div>
        <select
          id="profile-gender"
          name="gender"
          aria-describedby="profile-gender-description"
          value={localConfig.gender || ''}
          onChange={handleChange}
          className={`setting-select ${isDark ? 'dark' : 'light'}`}
        >
          <option value="">{t('genderNotSpecified')}</option>
          <option value="male">{t('genderMale')}</option>
          <option value="female">{t('genderFemale')}</option>
          <option value="other">{t('genderOther')}</option>
        </select>
      </div>
    </div>
  </div>
  );
}

export default PersonalSection;
