import { useState, useEffect, useRef, type ChangeEvent, type ComponentProps } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProfilePictureEditor from '../ProfilePictureEditor/ProfilePictureEditor';
import './ProfilePage.css';

// Import section components
import ProfilePageHeader from './ProfilePageHeader';
import ProfileHeaderCard from './ProfileHeaderCard';
import PersonalSection from './PersonalSection';
import AppearanceSection from './AppearanceSection';
import AISection from './AISection';
import CloudProvidersSection from './CloudProvidersSection';
import ProfileActions from './ProfileActions';
import DataPrivacySection from './DataPrivacySection';
import SubscriptionSection from './SubscriptionSection';

// Import types and utilities
import type { 
  TranslationFunction, 
  ProfileConfig, 
  ProfileUser, 
  ProfileStats 
} from './types';
import { 
  mergeUserProfileDefaults, 
  validatePasswordChange, 
  validateDeleteAccount, 
  isValidImageFile 
} from './types';

interface ProfilePageProps {
  readonly config: ProfileConfig;
  readonly onUpdateConfig: (config: ProfileConfig) => Promise<void>;
  readonly onDownloadData: () => Promise<boolean>;
  readonly onBack: () => void;
  readonly t: TranslationFunction;
  readonly stats?: ProfileStats;
}

type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>;

function ProfilePage({ config, onUpdateConfig, onDownloadData, onBack, t, stats }: ProfilePageProps) {
  const { user, changePassword, deleteAccount } = useAuth();
  const [localConfig, setLocalConfig] = useState<ProfileConfig>(config);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  // Profile picture state
  const [uploadingPicture, setUploadingPicture] = useState<boolean>(false);
  const [showPictureEditor, setShowPictureEditor] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save success toast
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  const handleDeleteAccountAction = async (): Promise<void> => {
    setDeleteError('');

    const validationError = validateDeleteAccount({ 
      deleteConfirmText, 
      user: user as ProfileUser | null, 
      deletePassword, 
      t 
    });
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

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    if (!user) return;
    setLocalConfig((prev) => mergeUserProfileDefaults(prev, user as ProfileUser));
  }, [user]);

  const handlePasswordChangeAction: FormSubmitHandler = (event) => {
    event.preventDefault();
    void (async () => {
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
    })();
  };

  const handlePictureUpload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file || !isValidImageFile(file)) return;

    setUploadingPicture(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalConfig((prev) => ({ ...prev, avatarUrl: reader.result as string }));
      setUploadingPicture(false);
    };
    reader.onerror = () => {
      setUploadingPicture(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePictureSave = (dataUrl: string): void => {
    setLocalConfig((prev) => ({ ...prev, avatarUrl: dataUrl }));
  };

  const triggerPictureUpload = (): void => {
    setShowPictureEditor(true);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }
  ): void => {
    const { name, value } = e.target;
    if (name === 'readDates') {
      setLocalConfig({ ...localConfig, [name]: value === 'true' });
    } else {
      setLocalConfig({ ...localConfig, [name]: value });
    }
  };

  const handleThemeToggle = (): void => {
    setLocalConfig({
      ...localConfig,
      theme: localConfig.theme === 'dark' ? 'light' : 'dark'
    });
  };

  const handleSave = (): void => {
    void (async () => {
      await onUpdateConfig(localConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    })();
  };

  const isLight = localConfig.theme === 'light';
  const isDark = !isLight;
  const isLocalAuth = (user as ProfileUser | null)?.authProvider === 'local';
  const initial = (localConfig.name || 'User').charAt(0).toUpperCase();
  const memberSince = stats?.firstEntryYear || new Date().getFullYear();

  return (
    <div className={`profile-page ${isDark ? 'dark' : 'light'}`}>
      <ProfilePictureEditor
        isOpen={showPictureEditor}
        onClose={() => setShowPictureEditor(false)}
        onSave={handlePictureSave}
        t={t}
        isDark={isDark}
      />

      <ProfilePageHeader onBack={onBack} isDark={isDark} t={t} />

      <ProfileHeaderCard
        localConfig={localConfig}
        user={user as ProfileUser | null}
        initial={initial}
        memberSince={memberSince}
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

        <DataPrivacySection
          t={t}
          isDark={isDark}
          onDownloadData={onDownloadData}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          deleteConfirmText={deleteConfirmText}
          setDeleteConfirmText={setDeleteConfirmText}
          deletePassword={deletePassword}
          setDeletePassword={setDeletePassword}
          deleteError={deleteError}
          setDeleteError={setDeleteError}
          deletingAccount={deletingAccount}
          handleDeleteAccount={handleDeleteAccountAction}
          isLocalAuth={isLocalAuth}
          handlePasswordChange={isLocalAuth ? handlePasswordChangeAction : undefined}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          passwordError={passwordError}
          passwordSuccess={passwordSuccess}
          changingPassword={changingPassword}
        />
      </div>

      <AppearanceSection
        localConfig={localConfig}
        handleChange={handleChange}
        handleThemeToggle={handleThemeToggle}
        isDark={isDark}
        isLight={isLight}
        t={t}
      />

      <AISection
        localConfig={localConfig}
        handleChange={handleChange}
        t={t}
      />

      <CloudProvidersSection
        t={t}
        isDark={isDark}
      />

      <SubscriptionSection
        localConfig={localConfig}
        handleChange={handleChange}
        isDark={isDark}
        t={t}
      />

      <ProfileActions onBack={onBack} handleSave={handleSave} t={t} />

      {saveSuccess && (
        <div className="profile-save-toast">{t('settingsSaved')}</div>
      )}
    </div>
  );
}

export default ProfilePage;
