import React, { ChangeEvent } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';

interface AppearanceSectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  handleThemeToggle: () => void;
  isDark: boolean;
  isLight: boolean;
  t: TranslationFunction;
}

const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  localConfig,
  handleChange,
  handleThemeToggle,
  isDark,
  isLight,
  t
}) => (
  <div className="profile-section">
    <div className="section-header">
      <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
      <h3 className="section-title">{t('appearance')}</h3>
    </div>
    <div className="section-content">
      <div className="settings-row-pair">
        <div className="setting-row horizontal">
          <div className="setting-info">
            <span className="setting-label">{t('theme')}</span>
            <span className="setting-description">{t('themeDescription')}</span>
          </div>
          <div className="theme-switch-container">
            <span className={`theme-label ${isLight ? 'active' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="theme-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
            <button
              type="button"
              className={`theme-switch ${isDark ? 'dark' : 'light'}`}
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
            >
              <span className={`switch-thumb ${isDark ? 'on' : 'off'}`} />
            </button>
            <span className={`theme-label ${isDark ? 'active' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="theme-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </span>
          </div>
        </div>

        <div className="setting-row horizontal">
          <div className="setting-info">
            <span className="setting-label">{t('entriesPerPage')}</span>
            <span className="setting-description">{t('entriesPerPageDescription')}</span>
          </div>
          <select
            name="entriesPerPage"
            value={localConfig.entriesPerPage || '10'}
            onChange={handleChange}
            className={`setting-select ${isDark ? 'dark' : 'light'}`}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      <div className="setting-row">
        <span className="setting-label">{t('language')}</span>
        <div className="language-selector">
          <button
            type="button"
            className={`lang-btn ${localConfig.language === 'en' ? 'active' : ''} ${isDark ? 'dark' : 'light'}`}
            onClick={() => handleChange({ target: { name: 'language', value: 'en' } })}
            title="English"
          >
            <img src="/flags/gb.svg" alt="UK Flag" className="flag-icon" /> English
          </button>
          <button
            type="button"
            className={`lang-btn ${localConfig.language === 'fr' ? 'active' : ''} ${isDark ? 'dark' : 'light'}`}
            onClick={() => handleChange({ target: { name: 'language', value: 'fr' } })}
            title="Français"
          >
            <img src="/flags/fr.svg" alt="French Flag" className="flag-icon" /> Français
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AppearanceSection;
