import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

function SettingsModal({ isOpen, onClose, config, onUpdateConfig, t }) {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setLocalConfig({ ...localConfig, [e.target.name]: e.target.value });
    };

    const handleThemeToggle = () => {
        setLocalConfig({
            ...localConfig,
            theme: localConfig.theme === 'dark' ? 'light' : 'dark'
        });
    };

    const handleVisibilityToggle = () => {
        setLocalConfig({
            ...localConfig,
            defaultVisibility: localConfig.defaultVisibility === 'private' ? 'public' : 'private'
        });
    };

    const handleSave = () => {
        onUpdateConfig(localConfig);
        onClose();
    };

    const isDark = localConfig.theme !== 'light';
    const isPublic = localConfig.defaultVisibility === 'public';

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={handleBackdropClick}
            data-testid="modal-backdrop"
        >
            <div className={`settings-modal ${isDark ? 'dark' : 'light'}`}>
                <div className="settings-header">
                    <h2 className="settings-title">{t('settings')}</h2>
                    <button onClick={onClose} className={`close-btn ${isDark ? 'dark' : 'light'}`} title={t('close')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="settings-form">
                    <div className="setting-row">
                        <label className="setting-label">{t('profileName')}</label>
                        <input
                            type="text"
                            name="name"
                            value={localConfig.name || ''}
                            onChange={handleChange}
                            className={`setting-input ${isDark ? 'dark' : 'light'}`}
                        />
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

                    <div className="setting-row">
                        <label className="setting-label">{t('entriesPerPage')}</label>
                        <select
                            name="entriesPerPage"
                            value={localConfig.entriesPerPage || '10'}
                            onChange={handleChange}
                            className={`setting-input ${isDark ? 'dark' : 'light'}`}
                        >
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                        </select>
                    </div>

                    <div className="setting-row">
                        <span className="setting-label">{t('theme')}</span>
                        <div className="theme-switch-container">
                            <span className={`theme-label ${!isDark ? 'active' : ''}`}>Light</span>
                            <button
                                type="button"
                                className={`theme-switch ${isDark ? 'dark' : 'light'}`}
                                onClick={handleThemeToggle}
                                aria-label="Toggle theme"
                            >
                                <span className={`switch-thumb ${isDark ? 'on' : 'off'}`} />
                            </button>
                            <span className={`theme-label ${isDark ? 'active' : ''}`}>Dark</span>
                        </div>
                    </div>



                    <div className="setting-row">
                        <span className="setting-label">{t('defaultVisibility')}</span>
                        <div className="theme-switch-container">
                            <span className={`theme-label ${!isPublic ? 'active' : ''}`}>{t('private')}</span>
                            <button
                                type="button"
                                className={`theme-switch ${isPublic ? 'public' : 'private'}`}
                                onClick={handleVisibilityToggle}
                                aria-label="Toggle default visibility"
                            >
                                <span className={`switch-thumb ${isPublic ? 'on' : 'off'}`} />
                            </button>
                            <span className={`theme-label ${isPublic ? 'active' : ''}`}>{t('public')}</span>
                        </div>
                    </div>
                </div>

                <div className="settings-actions">
                    <button
                        onClick={onClose}
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
        </div>
    );
}

export default SettingsModal;
