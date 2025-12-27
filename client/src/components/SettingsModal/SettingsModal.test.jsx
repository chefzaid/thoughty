import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from './SettingsModal';

describe('SettingsModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        config: {
            name: 'John Doe',
            theme: 'dark',
            entriesPerPage: '10',
            defaultVisibility: 'private'
        },
        onUpdateConfig: vi.fn(),
        t: (key) => key // Mock translation function
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('does not render when isOpen is false', () => {
            render(<SettingsModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('settings')).not.toBeInTheDocument();
        });

        it('renders when isOpen is true', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText('settings')).toBeInTheDocument();
        });

        it('displays profile name input with current value', () => {
            render(<SettingsModal {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            expect(input).toBeInTheDocument();
        });

        it('displays current theme state', () => {
            render(<SettingsModal {...defaultProps} />);
            // Check for the theme toggle button
            const toggle = screen.getByLabelText('Toggle theme');
            expect(toggle).toBeInTheDocument();
            // Verify it has the correct class for dark mode
            expect(toggle).toHaveClass('dark');
        });

        it('renders Cancel and Save Changes buttons', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText('cancel')).toBeInTheDocument();
            expect(screen.getByText('saveSettings')).toBeInTheDocument();
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

        it('toggles theme on button click', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} config={{ ...defaultProps.config, theme: 'light' }} />);

            const toggle = screen.getByLabelText('Toggle theme');
            expect(toggle).toHaveClass('light'); // Init state

            await user.click(toggle);

            expect(toggle).toHaveClass('dark');
        });

        it('updates entries per page', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} />);

            const select = screen.getByRole('combobox');
            await user.selectOptions(select, '25');

            expect(select.value).toBe('25');
        });

        it('updates language on click', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} />);

            const frBtn = screen.getByTitle('Français');
            await user.click(frBtn);

            expect(frBtn).toHaveClass('active');
        });

        it('updates default visibility on click', async () => {
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} />);

            const toggle = screen.getByLabelText('Toggle default visibility');
            await user.click(toggle);

            expect(toggle).toHaveClass('public');
        });
    });

    describe('Button actions', () => {
        it('calls onClose when Cancel is clicked without saving', async () => {
            const onClose = vi.fn();
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} onUpdateConfig={onUpdateConfig} />);

            await user.click(screen.getByText('cancel'));

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onUpdateConfig).not.toHaveBeenCalled();
        });

        it('calls onUpdateConfig and onClose when Save Changes is clicked', async () => {
            const onClose = vi.fn();
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} onUpdateConfig={onUpdateConfig} />);

            await user.click(screen.getByText('saveSettings'));

            expect(onUpdateConfig).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when clicking outside the modal', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} />);

            await user.click(screen.getByTestId('modal-backdrop'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when clicking inside the modal', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onClose={onClose} />);

            await user.click(screen.getByText('settings'));

            expect(onClose).not.toHaveBeenCalled();
        });

        it('saves updated values when Save Changes is clicked', async () => {
            const onUpdateConfig = vi.fn();
            const user = userEvent.setup();
            render(<SettingsModal {...defaultProps} onUpdateConfig={onUpdateConfig} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'New Name');

            const toggle = screen.getByLabelText('Toggle theme');
            await user.click(toggle);

            await user.click(screen.getByText('saveSettings'));

            expect(onUpdateConfig).toHaveBeenCalledWith(expect.objectContaining({
                name: 'New Name',
                theme: 'light'
            }));
        });
    });

    it('calls onClose when Escape key is pressed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<SettingsModal {...defaultProps} onClose={onClose} />);

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    describe('Config sync', () => {
        it('updates local config when props change', () => {
            const { rerender } = render(<SettingsModal {...defaultProps} />);

            expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();

            rerender(<SettingsModal {...defaultProps} config={{ name: 'Updated', theme: 'light' }} />);

            expect(screen.getByDisplayValue('Updated')).toBeInTheDocument();
        });
    });
});
