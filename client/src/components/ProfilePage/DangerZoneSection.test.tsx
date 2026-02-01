import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DangerZoneSection from './DangerZoneSection';

describe('DangerZoneSection', () => {
  const mockT = vi.fn((key: string) => key);
  const mockSetShowDeleteConfirm = vi.fn();
  const mockSetDeleteConfirmText = vi.fn();
  const mockSetDeleteError = vi.fn();
  const mockHandleDeleteAccount = vi.fn();

  const defaultProps = {
    t: mockT,
    isDark: true,
    showDeleteConfirm: false,
    setShowDeleteConfirm: mockSetShowDeleteConfirm,
    deleteConfirmText: '',
    setDeleteConfirmText: mockSetDeleteConfirmText,
    deleteError: '',
    setDeleteError: mockSetDeleteError,
    deletingAccount: false,
    handleDeleteAccount: mockHandleDeleteAccount,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders danger zone section with header', () => {
    render(<DangerZoneSection {...defaultProps} />);
    
    expect(screen.getByText('dangerZone')).toBeInTheDocument();
    expect(screen.getAllByText('deleteAccount')).toHaveLength(2); // label + button
    expect(screen.getByText('deleteAccountDescription')).toBeInTheDocument();
  });

  it('shows delete button when confirm is not shown', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={false} />);
    
    const deleteButton = screen.getByRole('button', { name: 'deleteAccount' });
    expect(deleteButton).toBeInTheDocument();
  });

  it('opens delete confirmation when delete button is clicked', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={false} />);
    
    const deleteButton = screen.getByRole('button', { name: 'deleteAccount' });
    fireEvent.click(deleteButton);
    
    expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(true);
  });

  it('shows confirmation UI when showDeleteConfirm is true', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} />);
    
    expect(screen.getByText('deleteAccountWarning')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('typeDeleteToConfirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'confirmDelete' })).toBeInTheDocument();
  });

  it('updates delete confirm text on input change', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} />);
    
    const input = screen.getByPlaceholderText('typeDeleteToConfirm');
    fireEvent.change(input, { target: { value: 'DELETE' } });
    
    expect(mockSetDeleteConfirmText).toHaveBeenCalledWith('DELETE');
  });

  it('cancels delete confirmation and resets state', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} />);
    
    const cancelButton = screen.getByRole('button', { name: 'cancel' });
    fireEvent.click(cancelButton);
    
    expect(mockSetShowDeleteConfirm).toHaveBeenCalledWith(false);
    expect(mockSetDeleteConfirmText).toHaveBeenCalledWith('');
    expect(mockSetDeleteError).toHaveBeenCalledWith('');
  });

  it('disables confirm button when text is not DELETE', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deleteConfirmText="DELET" />);
    
    const confirmButton = screen.getByRole('button', { name: 'confirmDelete' });
    expect(confirmButton).toBeDisabled();
  });

  it('enables confirm button when text is DELETE', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deleteConfirmText="DELETE" />);
    
    const confirmButton = screen.getByRole('button', { name: 'confirmDelete' });
    expect(confirmButton).not.toBeDisabled();
  });

  it('disables confirm button when deleting', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deleteConfirmText="DELETE" deletingAccount={true} />);
    
    const confirmButton = screen.getByRole('button', { name: 'deleting' });
    expect(confirmButton).toBeDisabled();
  });

  it('shows deleting text when deletingAccount is true', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deletingAccount={true} />);
    
    expect(screen.getByRole('button', { name: 'deleting' })).toBeInTheDocument();
  });

  it('calls handleDeleteAccount when confirm button is clicked', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deleteConfirmText="DELETE" />);
    
    const confirmButton = screen.getByRole('button', { name: 'confirmDelete' });
    fireEvent.click(confirmButton);
    
    expect(mockHandleDeleteAccount).toHaveBeenCalled();
  });

  it('displays delete error when present', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} deleteError="Failed to delete account" />);
    
    expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
  });

  it('applies dark theme styling to input', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} isDark={true} />);
    
    const input = screen.getByPlaceholderText('typeDeleteToConfirm');
    expect(input).toHaveClass('dark');
  });

  it('applies light theme styling to input', () => {
    render(<DangerZoneSection {...defaultProps} showDeleteConfirm={true} isDark={false} />);
    
    const input = screen.getByPlaceholderText('typeDeleteToConfirm');
    expect(input).toHaveClass('light');
  });
});
