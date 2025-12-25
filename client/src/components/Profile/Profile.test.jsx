import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Profile from './Profile';

describe('Profile', () => {
    const defaultProps = {
        name: 'John Doe',
        onOpenSettings: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('displays the user name', () => {
            render(<Profile {...defaultProps} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('displays the first letter as initial', () => {
            render(<Profile {...defaultProps} />);

            expect(screen.getByText('J')).toBeInTheDocument();
        });

        it('handles missing name with default', () => {
            render(<Profile name={undefined} onOpenSettings={vi.fn()} />);

            expect(screen.getByText('U')).toBeInTheDocument();
        });

        it('handles empty string name', () => {
            render(<Profile name="" onOpenSettings={vi.fn()} />);

            // Should use 'User' as fallback, showing 'U'
            expect(screen.getByText('U')).toBeInTheDocument();
        });

        it('capitalizes the initial', () => {
            render(<Profile name="john" onOpenSettings={vi.fn()} />);

            expect(screen.getByText('J')).toBeInTheDocument();
        });
    });

    describe('Settings button', () => {
        it('renders settings button', () => {
            render(<Profile {...defaultProps} />);

            const button = screen.getByTitle('Settings');
            expect(button).toBeInTheDocument();
        });

        it('calls onOpenSettings when clicked', async () => {
            const onOpenSettings = vi.fn();
            const user = userEvent.setup();
            render(<Profile name="John" onOpenSettings={onOpenSettings} />);

            await user.click(screen.getByTitle('Settings'));

            expect(onOpenSettings).toHaveBeenCalledTimes(1);
        });
    });

    describe('Avatar', () => {
        it('renders avatar container with gradient', () => {
            render(<Profile {...defaultProps} />);

            const avatar = screen.getByText('J');
            expect(avatar).toHaveClass('rounded-full');
            expect(avatar).toHaveClass('bg-gradient-to-br');
        });
    });
});
