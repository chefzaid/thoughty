import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryContentRenderer from './EntryContentRenderer';

describe('EntryContentRenderer', () => {
    const mockOnNavigateToEntry = vi.fn();

    const defaultProps = {
        content: '',
        onNavigateToEntry: mockOnNavigateToEntry,
        theme: 'dark'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Plain text rendering', () => {
        it('renders plain text without links', () => {
            render(<EntryContentRenderer {...defaultProps} content="Just some plain text" />);
            expect(screen.getByText('Just some plain text')).toBeInTheDocument();
        });

        it('renders empty content', () => {
            const { container } = render(<EntryContentRenderer {...defaultProps} content="" />);
            expect(container.textContent).toBe('');
        });

        it('renders null content', () => {
            const { container } = render(<EntryContentRenderer {...defaultProps} content={null} />);
            expect(container.textContent).toBe('');
        });
    });

    describe('Cross-reference detection', () => {
        it('detects entry (yyyy-mm-dd) format', () => {
            render(<EntryContentRenderer {...defaultProps} content="See entry (2026-01-10) for more" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('entry (2026-01-10)');
            expect(link).toHaveClass('entry-reference-link');
        });

        it('detects entry (yyyy-mm-dd--X) format with index inside parenthesis', () => {
            render(<EntryContentRenderer {...defaultProps} content="Check entry (2026-01-10--2)" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('entry (2026-01-10--2)');
        });

        it('detects multiple references in same content', () => {
            render(<EntryContentRenderer
                {...defaultProps}
                content="See entry (2026-01-10) and entry (2025-12-25--3) for details"
            />);

            const links = screen.getAllByRole('button');
            expect(links).toHaveLength(2);
            expect(links[0]).toHaveTextContent('entry (2026-01-10)');
            expect(links[1]).toHaveTextContent('entry (2025-12-25--3)');
        });

        it('handles entry with space before parenthesis', () => {
            render(<EntryContentRenderer {...defaultProps} content="See entry  (2026-01-10)" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent(/entry.*\(2026-01-10\)/);
        });

        it('preserves surrounding text', () => {
            render(<EntryContentRenderer {...defaultProps} content="Before entry (2026-01-10) after" />);

            expect(screen.getByText('Before')).toBeInTheDocument();
            expect(screen.getByText('after')).toBeInTheDocument();
        });
    });

    describe('Navigation callback', () => {
        it('calls onNavigateToEntry with date on click', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10)" />);

            await user.click(screen.getByRole('button'));

            expect(mockOnNavigateToEntry).toHaveBeenCalledWith('2026-01-10', 1);
        });

        it('calls onNavigateToEntry with date and index on click', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10--5)" />);

            await user.click(screen.getByRole('button'));

            expect(mockOnNavigateToEntry).toHaveBeenCalledWith('2026-01-10', 5);
        });

        it('handles Enter key for accessibility', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10)" />);

            const link = screen.getByRole('button');
            link.focus();
            await user.keyboard('{Enter}');

            expect(mockOnNavigateToEntry).toHaveBeenCalled();
        });

        it('handles Space key for accessibility', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10)" />);

            const link = screen.getByRole('button');
            link.focus();
            await user.keyboard(' ');

            expect(mockOnNavigateToEntry).toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('does not match invalid date formats', () => {
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-1-10) is invalid" />);

            // Should not create a link for invalid format
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.getByText(/entry \(2026-1-10\) is invalid/)).toBeInTheDocument();
        });

        it('handles reference at start of content', () => {
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10) starts this" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('entry (2026-01-10)');
        });

        it('handles reference at end of content', () => {
            render(<EntryContentRenderer {...defaultProps} content="This ends with entry (2026-01-10)" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('entry (2026-01-10)');
        });

        it('shows tooltip with navigation info', () => {
            render(<EntryContentRenderer {...defaultProps} content="entry (2026-01-10--2)" />);

            const link = screen.getByRole('button');
            expect(link).toHaveAttribute('title', 'Navigate to entry on 2026-01-10 (#2)');
        });
    });
});
