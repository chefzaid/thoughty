import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from './SettingsModal';

describe('SettingsModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        config: {
            profileName: 'John Doe',
            theme: 'dark'
        },
        onUpdateConfig: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('does not render when isOpen is false', () => {
            render(<SettingsModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('Settings')).not.toBeInTheDocument();
        });

        it('renders when isOpen is true', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText('Settings')).toBeInTheDocument();
        });

        it('displays profile name input with current value', () => {
            render(<SettingsModal {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            expect(input).toBeInTheDocument();
        });

        it('displays theme selector with current value', () => {
            render(<SettingsModal {...defaultProps} />);

            const select = screen.getByRole('combobox');
            expect(select.value).toBe('dark');
        });

        it('renders Cancel and Save Changes buttons', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Save Changes')).toBeInTheDocument();
        });
    });

    describe('Form interactions', () => {
        it('updates profile name on input change', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'Jane Smith');

            expect(input.value).toBe('Jane Smith');
        });

        it('updates theme on select change', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} />);

            const select = screen.getByRole('combobox');
            await user.selectOptions(select, 'light');

            expect(select.value).toBe('light');
        });
    });

    describe('Button actions', () => {
        it('calls onClose when Cancel is clicked without saving', async () => {
            const onClose = vi.fn();
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} onUpdateConfig={onUpdateConfig} />);

            await user.click(screen.getByText('Cancel'));

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onUpdateConfig).not.toHaveBeenCalled();
        });

        it('calls onUpdateConfig and onClose when Save Changes is clicked', async () => {
            const onClose = vi.fn();
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} onUpdateConfig={onUpdateConfig} />);

            await user.click(screen.getByText('Save Changes'));

            expect(onUpdateConfig).toHaveBeenCalledWith({
                profileName: 'John Doe',
                theme: 'dark'
            });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('saves updated values when Save Changes is clicked', async () => {
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onUpdateConfig={onUpdateConfig} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'New Name');

            const select = screen.getByRole('combobox');
            await user.selectOptions(select, 'light');

            await user.click(screen.getByText('Save Changes'));

            expect(onUpdateConfig).toHaveBeenCalledWith({
                profileName: 'New Name',
                theme: 'light'
            });
        });
    });

    describe('Config sync', () => {
        it('updates local config when props change', () => {
            const { rerender } = render(<SettingsModal {...defaultProps} />);

            expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();

            rerender(<SettingsModal {...defaultProps} config={{ profileName: 'Updated', theme: 'light' }} />);

            expect(screen.getByDisplayValue('Updated')).toBeInTheDocument();
        });
    });

    describe('Empty config handling', () => {
        it('handles missing profileName', () => {
            render(<SettingsModal {...defaultProps} config={{ theme: 'dark' }} />);

            const input = screen.getByRole('textbox');
            expect(input.value).toBe('');
        });

        it('handles missing theme with default', () => {
            render(<SettingsModal {...defaultProps} config={{ profileName: 'Test' }} />);

            const select = screen.getByRole('combobox');
            expect(select.value).toBe('dark');
        });
    });
});
