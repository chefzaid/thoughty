import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecuritySection from './SecuritySection';

describe('SecuritySection', () => {
  const mockT = vi.fn((key: string) => key);
  let mockHandlePasswordChange: Mock;
  let mockSetCurrentPassword: Mock;
  let mockSetNewPassword: Mock;
  let mockSetConfirmNewPassword: Mock;

  const getDefaultProps = () => ({
    t: mockT,
    isDark: true,
    handlePasswordChange: mockHandlePasswordChange,
    currentPassword: '',
    setCurrentPassword: mockSetCurrentPassword,
    newPassword: '',
    setNewPassword: mockSetNewPassword,
    confirmNewPassword: '',
    setConfirmNewPassword: mockSetConfirmNewPassword,
    passwordError: '',
    passwordSuccess: '',
    changingPassword: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlePasswordChange = vi.fn((e) => e.preventDefault());
    mockSetCurrentPassword = vi.fn();
    mockSetNewPassword = vi.fn();
    mockSetConfirmNewPassword = vi.fn();
  });

  it('renders security section with header', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    expect(screen.getByText('security')).toBeInTheDocument();
  });

  it('renders password change form fields', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    expect(screen.getByPlaceholderText('enterCurrentPassword')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('enterNewPassword')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('confirmNewPasswordPlaceholder')).toBeInTheDocument();
  });

  it('renders change password button', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    expect(screen.getByRole('button', { name: 'changePassword' })).toBeInTheDocument();
  });

  it('updates current password on input change', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    const input = screen.getByPlaceholderText('enterCurrentPassword');
    fireEvent.change(input, { target: { value: 'oldpass123' } });
    
    expect(mockSetCurrentPassword).toHaveBeenCalledWith('oldpass123');
  });

  it('updates new password on input change', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    const input = screen.getByPlaceholderText('enterNewPassword');
    fireEvent.change(input, { target: { value: 'newpass456' } });
    
    expect(mockSetNewPassword).toHaveBeenCalledWith('newpass456');
  });

  it('updates confirm password on input change', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    const input = screen.getByPlaceholderText('confirmNewPasswordPlaceholder');
    fireEvent.change(input, { target: { value: 'newpass456' } });
    
    expect(mockSetConfirmNewPassword).toHaveBeenCalledWith('newpass456');
  });

  it('displays password error when present', () => {
    render(<SecuritySection {...getDefaultProps()} passwordError="Passwords do not match" />);
    
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('displays password success when present', () => {
    render(<SecuritySection {...getDefaultProps()} passwordSuccess="Password changed successfully" />);
    
    expect(screen.getByText('Password changed successfully')).toBeInTheDocument();
  });

  it('disables change password button when changingPassword is true', () => {
    render(<SecuritySection {...getDefaultProps()} changingPassword={true} />);
    
    expect(screen.getByRole('button', { name: 'changingPassword' })).toBeDisabled();
  });

  it('shows changingPassword text when changing password', () => {
    render(<SecuritySection {...getDefaultProps()} changingPassword={true} />);
    
    expect(screen.getByRole('button', { name: 'changingPassword' })).toBeInTheDocument();
  });

  it('submits password change form', () => {
    render(<SecuritySection {...getDefaultProps()} />);
    
    const form = screen.getByRole('button', { name: 'changePassword' }).closest('form');
    fireEvent.submit(form!);
    
    expect(mockHandlePasswordChange).toHaveBeenCalled();
  });

  it('applies dark theme styling to inputs', () => {
    render(<SecuritySection {...getDefaultProps()} isDark={true} />);
    
    const currentPassInput = screen.getByPlaceholderText('enterCurrentPassword');
    expect(currentPassInput).toHaveClass('dark');
  });

  it('applies light theme styling to inputs', () => {
    render(<SecuritySection {...getDefaultProps()} isDark={false} />);
    
    const currentPassInput = screen.getByPlaceholderText('enterCurrentPassword');
    expect(currentPassInput).toHaveClass('light');
  });

  it('displays password field values', () => {
    render(<SecuritySection 
      {...getDefaultProps()} 
      currentPassword="current123" 
      newPassword="new456" 
      confirmNewPassword="new456" 
    />);
    
    expect(screen.getByDisplayValue('current123')).toBeInTheDocument();
    const newPassInputs = screen.getAllByDisplayValue('new456');
    expect(newPassInputs).toHaveLength(2);
  });
});
