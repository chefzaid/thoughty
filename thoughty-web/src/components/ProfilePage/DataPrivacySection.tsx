import { useState, type ComponentProps } from 'react';
import type { TranslationFunction } from './types';
import ActiveSessionsSection from './ActiveSessionsSection';

type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>;

interface PasswordFieldProps {
  label: string;
  value?: string;
  setValue?: (value: string) => void;
  placeholder: string;
  isDark: boolean;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  t: TranslationFunction;
}

interface PasswordSectionProps {
  isVisible: boolean;
  handlePasswordChange?: FormSubmitHandler;
  currentPassword?: string;
  setCurrentPassword?: (value: string) => void;
  newPassword?: string;
  setNewPassword?: (value: string) => void;
  confirmNewPassword?: string;
  setConfirmNewPassword?: (value: string) => void;
  passwordError?: string;
  passwordSuccess?: string;
  changingPassword?: boolean;
  isDark: boolean;
  showCurrentPassword: boolean;
  setShowCurrentPassword: (value: boolean) => void;
  showNewPassword: boolean;
  setShowNewPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  t: TranslationFunction;
}

interface DeleteAccountSectionProps {
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
  isLocalAuth: boolean;
  isDark: boolean;
  t: TranslationFunction;
}

function PasswordField({ label, value, setValue, placeholder, isDark, isVisible, setVisible, t }: Readonly<PasswordFieldProps>) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <label className="setting-label">{label}</label>
      </div>
      <div className="api-key-input-container">
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue?.(e.target.value)}
          placeholder={placeholder}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
        />
        <button type="button" className="api-key-toggle" onClick={() => setVisible(!isVisible)} aria-label={isVisible ? t('hidePassword') : t('showPassword')}>
          {isVisible ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function PasswordSection({
  isVisible,
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
  isDark,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  t,
}: Readonly<PasswordSectionProps>) {
  if (!isVisible || !handlePasswordChange || !setCurrentPassword || !setNewPassword || !setConfirmNewPassword) {
    return null;
  }

  return (
    <div className="change-password-subsection">
      <form onSubmit={handlePasswordChange} className="password-change-form">
        <PasswordField
          label={t('currentPassword')}
          value={currentPassword}
          setValue={setCurrentPassword}
          placeholder={t('enterCurrentPassword')}
          isDark={isDark}
          isVisible={showCurrentPassword}
          setVisible={setShowCurrentPassword}
          t={t}
        />
        <PasswordField
          label={t('newPassword')}
          value={newPassword}
          setValue={setNewPassword}
          placeholder={t('enterNewPassword')}
          isDark={isDark}
          isVisible={showNewPassword}
          setVisible={setShowNewPassword}
          t={t}
        />
        <PasswordField
          label={t('confirmNewPassword')}
          value={confirmNewPassword}
          setValue={setConfirmNewPassword}
          placeholder={t('confirmNewPasswordPlaceholder')}
          isDark={isDark}
          isVisible={showConfirmPassword}
          setVisible={setShowConfirmPassword}
          t={t}
        />
        {passwordError && <div className="password-error">{passwordError}</div>}
        {passwordSuccess && <div className="password-success">{passwordSuccess}</div>}
        <button type="submit" className="btn-change-password" disabled={changingPassword}>
          {changingPassword ? t('changingPassword') : t('changePassword')}
        </button>
      </form>
    </div>
  );
}

function DeleteAccountSection({
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConfirmText,
  setDeleteConfirmText,
  deletePassword,
  setDeletePassword,
  deleteError,
  setDeleteError,
  deletingAccount,
  handleDeleteAccount,
  isLocalAuth,
  isDark,
  t,
}: Readonly<DeleteAccountSectionProps>) {
  const resetDeleteState = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setDeleteError('');
  };

  if (!showDeleteConfirm) {
    return (
      <button type="button" className="btn-delete-account" onClick={() => setShowDeleteConfirm(true)}>
        {t('deleteAccount')}
      </button>
    );
  }

  return (
    <div className="delete-confirm-container">
      <p className="delete-warning">{t('deleteAccountWarning')}</p>
      <input
        type="text"
        value={deleteConfirmText}
        onChange={(e) => setDeleteConfirmText(e.target.value)}
        placeholder={t('typeDeleteToConfirm')}
        className={`setting-input delete-confirm-input ${isDark ? 'dark' : 'light'}`}
      />
      {isLocalAuth && (
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder={t('enterYourPassword')}
          className={`setting-input ${isDark ? 'dark' : 'light'}`}
        />
      )}
      {deleteError && <div className="password-error">{deleteError}</div>}
      <div className="delete-actions">
        <button type="button" className="btn-cancel-delete" onClick={resetDeleteState}>
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
  );
}

interface DataPrivacySectionProps {
  t: TranslationFunction;
  isDark: boolean;
  onDownloadData: () => Promise<boolean>;
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
  isLocalAuth: boolean;
  // Password change props
  handlePasswordChange?: FormSubmitHandler;
  currentPassword?: string;
  setCurrentPassword?: (value: string) => void;
  newPassword?: string;
  setNewPassword?: (value: string) => void;
  confirmNewPassword?: string;
  setConfirmNewPassword?: (value: string) => void;
  passwordError?: string;
  passwordSuccess?: string;
  changingPassword?: boolean;
}

function DataPrivacySection({ t, isDark, onDownloadData, showDeleteConfirm, setShowDeleteConfirm, deleteConfirmText, setDeleteConfirmText, deletePassword, setDeletePassword, deleteError, setDeleteError, deletingAccount, handleDeleteAccount, isLocalAuth, handlePasswordChange, currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmNewPassword, setConfirmNewPassword, passwordError, passwordSuccess, changingPassword }: Readonly<DataPrivacySectionProps>) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleDownload = async () => {
    setDownloadError('');
    setDownloading(true);
    const success = await onDownloadData();
    setDownloading(false);
    if (!success) {
      setDownloadError(t('downloadDataError'));
    }
  };

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="section-title">{t('dataPrivacy')}</h3>
      </div>
      <div className="section-content">
        <PasswordSection
          isVisible={isLocalAuth}
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
          isDark={isDark}
          showCurrentPassword={showCurrentPassword}
          setShowCurrentPassword={setShowCurrentPassword}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          t={t}
        />

        <div className="download-data-divider" />

        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">{t('downloadMyData')}</span>
            <span className="setting-description">{t('downloadMyDataDescription')}</span>
          </div>
          <button
            type="button"
            className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? t('downloading') : t('downloadMyData')}
          </button>
        </div>
        {downloadError && <div className="password-error">{downloadError}</div>}

        <div className="download-data-divider" />

        <ActiveSessionsSection isDark={isDark} t={t} />

        <div className="delete-account-section">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label danger">{t('deleteAccount')}</span>
              <span className="setting-description">{t('deleteAccountDescription')}</span>
            </div>
            <DeleteAccountSection
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
              isLocalAuth={isLocalAuth}
              isDark={isDark}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataPrivacySection;
