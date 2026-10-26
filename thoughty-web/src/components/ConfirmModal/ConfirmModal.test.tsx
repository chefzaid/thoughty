import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Delete Entry',
        message: 'Are you sure you want to delete this entry?',
        theme: 'dark' as const,
        t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('does not render when isOpen is false', () => {
            render(<ConfirmModal {...defaultProps} isOpen={false} />);

            expect(screen.queryByText('Delete Entry')).not.toBeInTheDocument();
        });

        it.each(['Delete Entry', 'Are you sure you want to delete this entry?'])(
            'displays %s when open', (text) => {
                render(<ConfirmModal {...defaultProps} />);
                expect(screen.getByText(text)).toBeInTheDocument();
            },
        );

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

    describe('Confirm label', () => {
        it('names the confirming action when one is given', async () => {
            const onConfirm = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} confirmLabel="Stop the memoir" />);

            expect(screen.queryByText('Delete')).not.toBeInTheDocument();
            await user.click(screen.getByText('Stop the memoir'));

            expect(onConfirm).toHaveBeenCalledTimes(1);
        });
    });

    describe('Backdrop', () => {
        it('calls onClose when backdrop is clicked', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} onClose={onClose} />);

            const backdrop = document.querySelector<HTMLElement>('.backdrop-blur-sm');
            expect(backdrop).not.toBeNull();
            expect(backdrop).toHaveAttribute('aria-hidden', 'true');
            expect(backdrop).toHaveAttribute('tabindex', '-1');
            await user.click(backdrop as HTMLElement);

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Dialog semantics', () => {
        it('is a modal alert dialog named by its title and described by its message', () => {
            render(<ConfirmModal {...defaultProps} />);

            const dialog = screen.getByRole('alertdialog', { name: 'Delete Entry' });
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAccessibleDescription('Are you sure you want to delete this entry?');
        });
    });

    describe('Keyboard', () => {
        function Page({ onConfirm = vi.fn() }: Readonly<{ onConfirm?: () => void }>) {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>Delete diary</button>
                    <button type="button">Behind</button>
                    <ConfirmModal
                        {...defaultProps}
                        isOpen={open}
                        onClose={() => setOpen(false)}
                        onConfirm={() => { onConfirm(); setOpen(false); }}
                    />
                </>
            );
        }

        it('moves focus to Cancel when it opens', async () => {
            const user = userEvent.setup();
            render(<Page />);

            await user.click(screen.getByRole('button', { name: 'Delete diary' }));

            expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        });

        it('keeps Tab and Shift+Tab inside the dialog', async () => {
            const user = userEvent.setup();
            render(<Page />);
            await user.click(screen.getByRole('button', { name: 'Delete diary' }));
            const cancel = screen.getByRole('button', { name: 'Cancel' });
            const confirm = screen.getByRole('button', { name: 'Delete' });

            await user.tab();
            expect(confirm).toHaveFocus();
            await user.tab();
            expect(cancel).toHaveFocus();
            await user.tab({ shift: true });
            expect(confirm).toHaveFocus();
        });

        it('cancels on Escape wherever focus is and returns focus to the trigger', async () => {
            const user = userEvent.setup();
            render(<Page />);
            const trigger = screen.getByRole('button', { name: 'Delete diary' });
            await user.click(trigger);
            await user.tab();

            await user.keyboard('{Escape}');

            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
        });

        it('confirms with the keyboard and returns focus to the trigger', async () => {
            const onConfirm = vi.fn();
            const user = userEvent.setup();
            render(<Page onConfirm={onConfirm} />);
            const trigger = screen.getByRole('button', { name: 'Delete diary' });
            await user.click(trigger);

            await user.tab();
            await user.keyboard('{Enter}');

            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
        });

        it('does not listen for Escape while closed', async () => {
            const onClose = vi.fn();
            const user = userEvent.setup();
            render(<ConfirmModal {...defaultProps} isOpen={false} onClose={onClose} />);

            await user.keyboard('{Escape}');

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('Language', () => {
        it.each([
            ['en', 'Cancel', 'Delete'],
            ['fr', 'Annuler', 'Supprimer'],
        ] as const)('labels the buttons in %s', (language, cancelLabel, deleteLabel) => {
            render(<ConfirmModal {...defaultProps} t={(key, params) => getTranslation(language, key, params)} />);

            expect(screen.getByRole('button', { name: cancelLabel })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: deleteLabel })).toBeInTheDocument();
        });
    });
});
