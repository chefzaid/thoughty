import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Delete Entry',
        message: 'Are you sure you want to delete this entry?',
        theme: 'dark'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('does not render when isOpen is false', () => {
            render(<ConfirmModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('Delete Entry')).not.toBeInTheDocument();
        });

        it('renders when isOpen is true', () => {
            render(<ConfirmModal {...defaultProps} />);

            expect(screen.getByText('Delete Entry')).toBeInTheDocument();
        });

        it('displays the title', () => {
            render(<ConfirmModal {...defaultProps} />);

            expect(screen.getByText('Delete Entry')).toBeInTheDocument();
        });

        it('displays the message', () => {
            render(<ConfirmModal {...defaultProps} />);

            expect(screen.getByText('Are you sure you want to delete this entry?')).toBeInTheDocument();
        });

        it('renders Cancel and Delete buttons', () => {
            render(<ConfirmModal {...defaultProps} />);

            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });
    });

    describe('Theme styling', () => {
        it('applies dark theme styles', () => {
            render(<ConfirmModal {...defaultProps} theme="dark" />);

            const modal = screen.getByText('Delete Entry').closest('div[class*="rounded-xl"]');
            expect(modal).toHaveClass('bg-gray-800');
        });

        it('applies light theme styles', () => {
            render(<ConfirmModal {...defaultProps} theme="light" />);

            const modal = screen.getByText('Delete Entry').closest('div[class*="rounded-xl"]');
            expect(modal).toHaveClass('bg-white');
        });
    });

    describe('Button interactions', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} onClose={onClose} />);

            await user.click(screen.getByText('Cancel'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onConfirm when Delete is clicked', async () => {
            const onConfirm = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

            await user.click(screen.getByText('Delete'));

            expect(onConfirm).toHaveBeenCalledTimes(1);
        });
    });

    describe('Backdrop', () => {
        it('calls onClose when backdrop is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} onClose={onClose} />);

            // Find the backdrop element
            const backdrop = document.querySelector('.backdrop-blur-sm');
            await user.click(backdrop);

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
