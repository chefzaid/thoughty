import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DataPrivacySection from './DataPrivacySection';
import { PASSWORD_SYMBOLS } from '../AuthPage/types';

vi.mock('./ActiveSessionsSection', () => ({ default: () => null }));
vi.mock('./TwoFactorSection', () => ({ default: () => null }));

const t = (key: string, params?: Record<string, string | number>): string =>
  params ? `${key} ${JSON.stringify(params)}` : key;

function renderSection() {
  render(
    <DataPrivacySection
      t={t}
      isDark
      onDownloadData={vi.fn().mockResolvedValue(true)}
      showDeleteConfirm={false}
      setShowDeleteConfirm={vi.fn()}
      deleteConfirmText=""
      setDeleteConfirmText={vi.fn()}
      deletePassword=""
      setDeletePassword={vi.fn()}
      deleteError=""
      setDeleteError={vi.fn()}
      deletingAccount={false}
      handleDeleteAccount={vi.fn()}
      isLocalAuth
      handlePasswordChange={vi.fn()}
      currentPassword=""
      setCurrentPassword={vi.fn()}
      newPassword=""
      setNewPassword={vi.fn()}
      confirmNewPassword=""
      setConfirmNewPassword={vi.fn()}
    />,
  );
}

describe('DataPrivacySection password change', () => {
  it('states the password rule under the new password only', () => {
    renderSection();

    expect(screen.getByLabelText('newPassword')).toHaveAccessibleDescription(
      `passwordRequirements ${JSON.stringify({ symbols: PASSWORD_SYMBOLS })}`,
    );
    expect(screen.getByLabelText('currentPassword')).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText('confirmNewPassword')).not.toHaveAccessibleDescription();
  });

  it('tells password managers which field takes the current password and which a new one', () => {
    renderSection();

    expect(screen.getByLabelText('currentPassword')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('newPassword')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('confirmNewPassword')).toHaveAttribute('autocomplete', 'new-password');
  });
});
