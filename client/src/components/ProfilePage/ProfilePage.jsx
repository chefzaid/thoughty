import React, { useState, useEffect } from 'react';
import './ProfilePage.css';

function ProfilePage({ config, onUpdateConfig, onBack, t, stats }) {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (e) => {
        setLocalConfig({ ...localConfig, [e.target.name]: e.target.value });
    };

    const handleThemeToggle = () => {
        setLocalConfig({
            ...localConfig,
            theme: localConfig.theme === 'dark' ? 'light' : 'dark'
        });
    };

    const handleSave = () => {
        onUpdateConfig(localConfig);
        onBack();
    };

    const isDark = localConfig.theme !== 'light';
    const initial = (localConfig.name || 'User').charAt(0).toUpperCase();

    // Calculate member since from stats or use current year
    const memberSince = stats?.firstEntryYear || new Date().getFullYear();

    return (
        <div className={`profile-page ${isDark ? 'dark' : 'light'}`}>
            <div className="profile-page-header">
                <button onClick={onBack} className={`back-btn ${isDark ? 'dark' : 'light'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t('back')}
                </button>
                <h1 className="profile-page-title">{t('profile')}</h1>
            </div>

            {/* Profile Header Card */}
            <div className="profile-header-card">
                <div className="profile-avatar-large">
                    {initial}
                </div>
                <div className="profile-header-info">
                    <h2 className="profile-display-name">{localConfig.name || t('user')}</h2>
                    <p className="profile-member-since">
                        <svg xmlns="http://www.w3.org/2000/svg" className="member-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {t('memberSince', { year: memberSince })}
                    </p>
                </div>
            </div>

            {/* Personal Section */}
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
                            <label className="setting-label">{t('displayName')}</label>
                            <span className="setting-description">{t('displayNameDescription')}</span>
                        </div>
                        <input
                            type="text"
                            name="name"
                            value={localConfig.name || ''}
                            onChange={handleChange}
                            placeholder={t('enterYourName')}
                            className={`setting-input ${isDark ? 'dark' : 'light'}`}
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
                            <label className="setting-label">{t('location')}</label>
                            <span className="setting-description">{t('locationDescription')}</span>
                        </div>
                        <input
                            type="text"
                            name="location"
                            value={localConfig.location || ''}
                            onChange={handleChange}
                            placeholder={t('enterYourLocation')}
                            className={`setting-input ${isDark ? 'dark' : 'light'}`}
                        />
                    </div>
                </div>
            </div>

            {/* Appearance Section */}
            <div className="profile-section">
                <div className="section-header">
                    <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <h3 className="section-title">{t('appearance')}</h3>
                </div>
                <div className="section-content">
                    <div className="setting-row horizontal">
                        <div className="setting-info">
                            <span className="setting-label">{t('theme')}</span>
                            <span className="setting-description">{t('themeDescription')}</span>
                        </div>
                        <div className="theme-switch-container">
                            <span className={`theme-label ${!isDark ? 'active' : ''}`}>
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

            {/* Preferences Section */}
            <div className="profile-section">
                <div className="section-header">
                    <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="section-title">{t('preferences')}</h3>
                </div>
                <div className="section-content">
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
            </div>

            {/* Action Buttons */}
            <div className="profile-actions">
                <button
                    onClick={onBack}
                    className="btn-cancel"
                >
                    {t('cancel')}
                </button>
                <button
                    onClick={handleSave}
                    className="btn-save"
                >
                    {t('saveSettings')}
                </button>
            </div>
        </div>
    );
}

export default ProfilePage;
