import React, { FormEvent } from 'react';
import type { TranslationFunction } from './types';

interface SecuritySectionProps {
  t: TranslationFunction;
  isDark: boolean;
  handlePasswordChange: (e: FormEvent<HTMLFormElement>) => void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (value: string) => void;
  passwordError: string;
  passwordSuccess: string;
  changingPassword: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (value: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (value: string) => void;
  deletePassword: string;
  setDeletePassword: (value: string) => void;
  deleteError: string;
  setDeleteError: (value: string) => void;
  deletingAccount: boolean;
  handleDeleteAccount: () => void;
}

const SecuritySection: React.FC<SecuritySectionProps> = ({
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
        {passwordError && <div className="password-error">{passwordError}</div>}
        {passwordSuccess && <div className="password-success">{passwordSuccess}</div>}
        <button type="submit" className="btn-change-password" disabled={changingPassword}>
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
              {deleteError && <div className="password-error">{deleteError}</div>}
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
            <button type="button" className="btn-delete-account" onClick={() => setShowDeleteConfirm(true)}>
              {t('deleteAccount')}
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default SecuritySection;
