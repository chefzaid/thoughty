import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import ProfilePictureEditor from '../ProfilePictureEditor/ProfilePictureEditor';
import './ProfilePage.css';

const DEFAULT_BIRTHDAY_YEARS_AGO = 18;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const getDefaultBirthday = (yearsAgo = DEFAULT_BIRTHDAY_YEARS_AGO) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - yearsAgo);
    return date.toISOString().split('T')[0];
};

const mergeUserProfileDefaults = (prev, user) => {
    if (!user) return prev;

    const updates = {};

    if (user.email && !prev.email) {
        updates.email = user.email;
    }

    if (user.username && (!prev.name || prev.name === 'User')) {
        updates.name = user.username;
    }

    if (user.avatarUrl && !prev.avatarUrl) {
        updates.avatarUrl = user.avatarUrl;
    }

    return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
};

const validatePasswordChange = ({ currentPassword, newPassword, confirmNewPassword, t }) => {
    if (!currentPassword || !newPassword) return t('currentAndNewPasswordRequired');
    if (newPassword.length < 6) return t('passwordMinLength');
    if (newPassword !== confirmNewPassword) return t('passwordsDoNotMatch');
    return '';
};

const validateDeleteAccount = ({ deleteConfirmText, user, deletePassword, t }) => {
    if (deleteConfirmText !== 'DELETE') return t('typeDeleteToConfirm');
    if (user?.authProvider === 'local' && !deletePassword) return t('passwordRequired');
    return '';
};

const isValidImageFile = (file) => Boolean(file?.type?.startsWith('image/') && file?.size <= MAX_AVATAR_SIZE_BYTES);

const handlePasswordChangeAction = async ({
    event,
    currentPassword,
    newPassword,
    confirmNewPassword,
    t,
    changePassword,
    setPasswordError,
    setPasswordSuccess,
    setChangingPassword,
    setCurrentPassword,
    setNewPassword,
    setConfirmNewPassword
}) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const validationError = validatePasswordChange({
        currentPassword,
        newPassword,
        confirmNewPassword,
        t
    });
    if (validationError) {
        setPasswordError(validationError);
        return;
    }

    setChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);

    if (result.success) {
        setPasswordSuccess(t('passwordChangeSuccess'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
    } else {
        setPasswordError(result.error || t('passwordChangeFailed'));
    }
};

const handleDeleteAccountAction = async ({
    deleteConfirmText,
    user,
    deletePassword,
    t,
    deleteAccount,
    setDeleteError,
    setDeletingAccount
}) => {
    setDeleteError('');

    const validationError = validateDeleteAccount({ deleteConfirmText, user, deletePassword, t });
    if (validationError) {
        setDeleteError(validationError);
        return;
    }

    setDeletingAccount(true);
    const result = await deleteAccount(deletePassword);
    setDeletingAccount(false);

    if (!result.success) {
        setDeleteError(result.error || t('deleteAccountFailed'));
    }
};

const handlePictureUploadAction = ({ event, setUploadingPicture, setLocalConfig }) => {
    const file = event.target.files?.[0];
    if (!isValidImageFile(file)) return;

    setUploadingPicture(true);

    const reader = new FileReader();
    reader.onloadend = () => {
        setLocalConfig(prev => ({ ...prev, avatarUrl: reader.result }));
        setUploadingPicture(false);
    };
    reader.onerror = () => {
        setUploadingPicture(false);
    };
    reader.readAsDataURL(file);
};

const profileConfigShape = PropTypes.shape({
    name: PropTypes.string,
    bio: PropTypes.string,
    email: PropTypes.string,
    birthday: PropTypes.string,
    avatarUrl: PropTypes.string,
    theme: PropTypes.string,
    language: PropTypes.string,
    entriesPerPage: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
});

const ProfilePageHeader = ({ onBack, isDark, t }) => (
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

ProfilePageHeader.propTypes = {
    onBack: PropTypes.func.isRequired,
    isDark: PropTypes.bool.isRequired,
    t: PropTypes.func.isRequired
};

const ProfileHeaderCard = ({
    localConfig,
    user,
    initial,
    memberSince,
    isDark,
    t,
    triggerPictureUpload,
    fileInputRef,
    handlePictureUpload,
    uploadingPicture
}) => (
    <div className="profile-header-card">
        <div className="profile-avatar-container">
            <button
                type="button"
                className="profile-avatar-large clickable"
                onClick={triggerPictureUpload}
                title={t('changeProfilePicture')}
                aria-label={t('changeProfilePicture')}
            >
                {localConfig.avatarUrl || user?.avatarUrl ? (
                    <img
                        src={localConfig.avatarUrl || user?.avatarUrl}
                        alt="Profile"
                        className="avatar-image"
                    />
                ) : (
                    initial
                )}
                <div className="avatar-overlay">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                className="hidden-file-input"
            />
            {uploadingPicture && <div className="upload-spinner"></div>}
        </div>
        <div className="profile-header-info">
            <div className="profile-name-row">
                <h2 className="profile-display-name">{localConfig.name || t('user')}</h2>
                {user?.username && (
                    <span className="profile-username">@{user.username}</span>
                )}
            </div>
            <p className="profile-member-since">
                <svg xmlns="http://www.w3.org/2000/svg" className="member-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('memberSince', { year: memberSince })}
            </p>
        </div>
    </div>
);

ProfileHeaderCard.propTypes = {
    localConfig: profileConfigShape.isRequired,
    user: PropTypes.shape({
        username: PropTypes.string,
    avatarUrl: PropTypes.string
    }),
    initial: PropTypes.string.isRequired,
    memberSince: PropTypes.number.isRequired,
    isDark: PropTypes.bool.isRequired,
    t: PropTypes.func.isRequired,
    triggerPictureUpload: PropTypes.func.isRequired,
    fileInputRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.any })
    ]).isRequired,
    handlePictureUpload: PropTypes.func.isRequired,
    uploadingPicture: PropTypes.bool.isRequired
};

const PersonalSection = ({ localConfig, handleChange, setLocalConfig, isDark, t }) => (
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
                            setLocalConfig(prev => ({ ...prev, birthday: getDefaultBirthday() }));
                        }
                    }}
                    className={`setting-input ${isDark ? 'dark' : 'light'}`}
                />
            </div>
        </div>
    </div>
);

PersonalSection.propTypes = {
    localConfig: profileConfigShape.isRequired,
    handleChange: PropTypes.func.isRequired,
    setLocalConfig: PropTypes.func.isRequired,
    isDark: PropTypes.bool.isRequired,
    t: PropTypes.func.isRequired
};

const AppearanceSection = ({ localConfig, handleChange, handleThemeToggle, isDark, isLight, t }) => (
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

AppearanceSection.propTypes = {
    localConfig: profileConfigShape.isRequired,
    handleChange: PropTypes.func.isRequired,
    handleThemeToggle: PropTypes.func.isRequired,
    isDark: PropTypes.bool.isRequired,
    isLight: PropTypes.bool.isRequired,
    t: PropTypes.func.isRequired
};

const SecuritySection = ({
    t,
    isDark,
    handlePasswordChange,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    passwordError,
    passwordSuccess,
    changingPassword,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteConfirmText,
    setDeleteConfirmText,
    deletePassword,
    setDeletePassword,
    deleteError,
    setDeleteError,
    deletingAccount,
    handleDeleteAccount
}) => (
    <div className="profile-section">
        <div className="section-header">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="section-title">{t('security')}</h3>
        </div>
        <div className="section-content">
            <form onSubmit={handlePasswordChange} className="password-change-form">
                <div className="setting-row">
                    <div className="setting-info">
                        <label className="setting-label">{t('currentPassword')}</label>
                    </div>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={t('enterCurrentPassword')}
                        className={`setting-input ${isDark ? 'dark' : 'light'}`}
                    />
                </div>
                <div className="setting-row">
                    <div className="setting-info">
                        <label className="setting-label">{t('newPassword')}</label>
                    </div>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('enterNewPassword')}
                        className={`setting-input ${isDark ? 'dark' : 'light'}`}
                    />
                </div>
                <div className="setting-row">
                    <div className="setting-info">
                        <label className="setting-label">{t('confirmNewPassword')}</label>
                    </div>
                    <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={t('confirmNewPasswordPlaceholder')}
                        className={`setting-input ${isDark ? 'dark' : 'light'}`}
                    />
                </div>
                {passwordError && (
                    <div className="password-error">{passwordError}</div>
                )}
                {passwordSuccess && (
                    <div className="password-success">{passwordSuccess}</div>
                )}
                <button
                    type="submit"
                    className="btn-change-password"
                    disabled={changingPassword}
                >
                    {changingPassword ? t('changingPassword') : t('changePassword')}
                </button>
            </form>

            <div className="delete-account-section">
                <div className="setting-row">
                    <div className="setting-info">
                        <span className="setting-label danger">{t('deleteAccount')}</span>
                        <span className="setting-description">{t('deleteAccountDescription')}</span>
                    </div>
                    {showDeleteConfirm ? (
                        <div className="delete-confirm-container">
                            <p className="delete-warning">{t('deleteAccountWarning')}</p>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder={t('typeDeleteToConfirm')}
                                className={`setting-input delete-confirm-input ${isDark ? 'dark' : 'light'}`}
                            />
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder={t('enterYourPassword')}
                                className={`setting-input ${isDark ? 'dark' : 'light'}`}
                            />
                            {deleteError && (
                                <div className="password-error">{deleteError}</div>
                            )}
                            <div className="delete-actions">
                                <button
                                    type="button"
                                    className="btn-cancel-delete"
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteConfirmText('');
                                        setDeletePassword('');
                                        setDeleteError('');
                                    }}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-confirm-delete"
                                    onClick={handleDeleteAccount}
                                    disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                                >
                                    {deletingAccount ? t('deleting') : t('confirmDelete')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn-delete-account"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            {t('deleteAccount')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
);

SecuritySection.propTypes = {
    t: PropTypes.func.isRequired,
    isDark: PropTypes.bool.isRequired,
    handlePasswordChange: PropTypes.func.isRequired,
    currentPassword: PropTypes.string.isRequired,
    setCurrentPassword: PropTypes.func.isRequired,
    newPassword: PropTypes.string.isRequired,
    setNewPassword: PropTypes.func.isRequired,
    confirmNewPassword: PropTypes.string.isRequired,
    setConfirmNewPassword: PropTypes.func.isRequired,
    passwordError: PropTypes.string.isRequired,
    passwordSuccess: PropTypes.string.isRequired,
    changingPassword: PropTypes.bool.isRequired,
    showDeleteConfirm: PropTypes.bool.isRequired,
    setShowDeleteConfirm: PropTypes.func.isRequired,
    deleteConfirmText: PropTypes.string.isRequired,
    setDeleteConfirmText: PropTypes.func.isRequired,
    deletePassword: PropTypes.string.isRequired,
    setDeletePassword: PropTypes.func.isRequired,
    deleteError: PropTypes.string.isRequired,
    setDeleteError: PropTypes.func.isRequired,
    deletingAccount: PropTypes.bool.isRequired,
    handleDeleteAccount: PropTypes.func.isRequired
};

const DangerZoneSection = ({
    t,
    isDark,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteConfirmText,
    setDeleteConfirmText,
    deleteError,
    setDeleteError,
    deletingAccount,
    handleDeleteAccount
}) => (
    <div className="profile-section danger-section">
        <div className="section-header">
            <svg xmlns="http://www.w3.org/2000/svg" className="section-icon danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="section-title danger">{t('dangerZone')}</h3>
        </div>
        <div className="section-content">
            <div className="setting-row">
                <div className="setting-info">
                    <span className="setting-label danger">{t('deleteAccount')}</span>
                    <span className="setting-description">{t('deleteAccountDescription')}</span>
                </div>
                {showDeleteConfirm ? (
                    <div className="delete-confirm-container">
                        <p className="delete-warning">{t('deleteAccountWarning')}</p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={t('typeDeleteToConfirm')}
                            className={`setting-input delete-confirm-input ${isDark ? 'dark' : 'light'}`}
                        />
                        {deleteError && (
                            <div className="password-error">{deleteError}</div>
                        )}
                        <div className="delete-actions">
                            <button
                                type="button"
                                className="btn-cancel-delete"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmText('');
                                    setDeleteError('');
                                }}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-confirm-delete"
                                onClick={handleDeleteAccount}
                                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                            >
                                {deletingAccount ? t('deleting') : t('confirmDelete')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="btn-delete-account"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        {t('deleteAccount')}
                    </button>
                )}
            </div>
        </div>
    </div>
);

DangerZoneSection.propTypes = {
    t: PropTypes.func.isRequired,
    isDark: PropTypes.bool.isRequired,
    showDeleteConfirm: PropTypes.bool.isRequired,
    setShowDeleteConfirm: PropTypes.func.isRequired,
    deleteConfirmText: PropTypes.string.isRequired,
    setDeleteConfirmText: PropTypes.func.isRequired,
    deleteError: PropTypes.string.isRequired,
    setDeleteError: PropTypes.func.isRequired,
    deletingAccount: PropTypes.bool.isRequired,
    handleDeleteAccount: PropTypes.func.isRequired
};

const ProfileActions = ({ onBack, handleSave, t }) => (
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
);

ProfileActions.propTypes = {
    onBack: PropTypes.func.isRequired,
    handleSave: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

function ProfilePage({ config, onUpdateConfig, onBack, t, stats }) {
    const { user, changePassword, deleteAccount } = useAuth();
    const [localConfig, setLocalConfig] = useState(config);
    
    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    
    // Profile picture state
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [showPictureEditor, setShowPictureEditor] = useState(false);
    const fileInputRef = React.useRef(null);
    
    // Delete account state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const handleDeleteAccount = () => handleDeleteAccountAction({
        deleteConfirmText,
        user,
        deletePassword,
        t,
        deleteAccount,
        setDeleteError,
        setDeletingAccount
    });

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    // Preload user data into config if not already set
    useEffect(() => {
        if (!user) return;

        setLocalConfig(prev => mergeUserProfileDefaults(prev, user));
    }, [user]);

    const handlePasswordChange = (event) => handlePasswordChangeAction({
        event,
        currentPassword,
        newPassword,
        confirmNewPassword,
        t,
        changePassword,
        setPasswordError,
        setPasswordSuccess,
        setChangingPassword,
        setCurrentPassword,
        setNewPassword,
        setConfirmNewPassword
    });

    const handlePictureUpload = (event) => handlePictureUploadAction({
        event,
        setUploadingPicture,
        setLocalConfig
    });

    const handlePictureSave = (dataUrl) => {
        setLocalConfig(prev => ({ ...prev, avatarUrl: dataUrl }));
    };

    const triggerPictureUpload = () => {
        setShowPictureEditor(true);
    };

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

    const isLight = localConfig.theme === 'light';
    const isDark = !isLight;
    const isLocalAuth = user?.authProvider === 'local';
    const initial = (localConfig.name || 'User').charAt(0).toUpperCase();

    // Calculate member since from stats or use current year
    const memberSince = stats?.firstEntryYear || new Date().getFullYear();

    return (
        <div className={`profile-page ${isDark ? 'dark' : 'light'}`}>
            {/* Profile Picture Editor Modal */}
            <ProfilePictureEditor
                isOpen={showPictureEditor}
                onClose={() => setShowPictureEditor(false)}
                onSave={handlePictureSave}
                currentImage={localConfig.avatarUrl || user?.avatarUrl}
                t={t}
                isDark={isDark}
            />

            <ProfilePageHeader onBack={onBack} isDark={isDark} t={t} />

            <ProfileHeaderCard
                localConfig={localConfig}
                user={user}
                initial={initial}
                memberSince={memberSince}
                isDark={isDark}
                t={t}
                triggerPictureUpload={triggerPictureUpload}
                fileInputRef={fileInputRef}
                handlePictureUpload={handlePictureUpload}
                uploadingPicture={uploadingPicture}
            />

            <div className="profile-two-column">
                <PersonalSection
                    localConfig={localConfig}
                    handleChange={handleChange}
                    setLocalConfig={setLocalConfig}
                    isDark={isDark}
                    t={t}
                />

                {isLocalAuth ? (
                    <SecuritySection
                        t={t}
                        isDark={isDark}
                        handlePasswordChange={handlePasswordChange}
                        currentPassword={currentPassword}
                        setCurrentPassword={setCurrentPassword}
                        newPassword={newPassword}
                        setNewPassword={setNewPassword}
                        confirmNewPassword={confirmNewPassword}
                        setConfirmNewPassword={setConfirmNewPassword}
                        passwordError={passwordError}
                        passwordSuccess={passwordSuccess}
                        changingPassword={changingPassword}
                        showDeleteConfirm={showDeleteConfirm}
                        setShowDeleteConfirm={setShowDeleteConfirm}
                        deleteConfirmText={deleteConfirmText}
                        setDeleteConfirmText={setDeleteConfirmText}
                        deletePassword={deletePassword}
                        setDeletePassword={setDeletePassword}
                        deleteError={deleteError}
                        setDeleteError={setDeleteError}
                        deletingAccount={deletingAccount}
                        handleDeleteAccount={handleDeleteAccount}
                    />
                ) : (
                    <DangerZoneSection
                        t={t}
                        isDark={isDark}
                        showDeleteConfirm={showDeleteConfirm}
                        setShowDeleteConfirm={setShowDeleteConfirm}
                        deleteConfirmText={deleteConfirmText}
                        setDeleteConfirmText={setDeleteConfirmText}
                        deleteError={deleteError}
                        setDeleteError={setDeleteError}
                        deletingAccount={deletingAccount}
                        handleDeleteAccount={handleDeleteAccount}
                    />
                )}
            </div>

            <AppearanceSection
                localConfig={localConfig}
                handleChange={handleChange}
                handleThemeToggle={handleThemeToggle}
                isDark={isDark}
                isLight={isLight}
                t={t}
            />

            <ProfileActions onBack={onBack} handleSave={handleSave} t={t} />
        </div>
    );
}

export default ProfilePage;

ProfilePage.propTypes = {
    config: profileConfigShape.isRequired,
    onUpdateConfig: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
    stats: PropTypes.shape({
        firstEntryYear: PropTypes.number
    })
};
