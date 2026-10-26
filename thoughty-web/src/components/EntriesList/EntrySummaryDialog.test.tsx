import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from './EntriesList.test-utils';
import EntrySummaryDialog from './EntrySummaryDialog';

function SummaryHarness() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setIsOpen(true)}>Summarize</button>
            <EntrySummaryDialog
                entryId={3}
                isOpen={isOpen}
                isDark
                onClose={() => setIsOpen(false)}
                onSummarize={vi.fn()}
                t={t}
            />
        </>
    );
}

describe('EntrySummaryDialog', () => {
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generates, regenerates, and copies a guided summary', async () => {
        const onSummarize = vi.fn()
            .mockResolvedValueOnce('The entry records a careful decision.')
            .mockResolvedValueOnce('A revised decision summary.');
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, 'writeText');

        render(
            <EntrySummaryDialog
                entryId={12}
                isOpen
                isDark
                onClose={onClose}
                onSummarize={onSummarize}
                t={t}
            />,
        );

        await user.type(screen.getByLabelText('Emphasize'), 'the decision');
        await user.type(screen.getByLabelText('Leave out'), 'names');
        await user.click(screen.getByRole('button', { name: 'Generate summary' }));

        expect(await screen.findByText('The entry records a careful decision.')).toBeInTheDocument();
        expect(onSummarize).toHaveBeenCalledWith(12, {
            includeDetails: 'the decision',
            excludeDetails: 'names',
        });

        await user.click(screen.getByRole('button', { name: 'Copy summary' }));
        expect(writeText).toHaveBeenCalledWith('The entry records a careful decision.');
        expect(screen.getByRole('button', { name: 'Summary copied' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Regenerate' }));
        expect(await screen.findByText('A revised decision summary.')).toBeInTheDocument();
        expect(onSummarize).toHaveBeenCalledTimes(2);
    });

    it('shows failures and closes on Escape', async () => {
        const onSummarize = vi.fn()
            .mockRejectedValueOnce(new Error('Network unavailable'))
            .mockResolvedValueOnce(null);
        const user = userEvent.setup();

        render(
            <EntrySummaryDialog
                entryId={12}
                isOpen
                isDark={false}
                onClose={onClose}
                onSummarize={onSummarize}
                t={t}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Generate summary' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to summarize entry');

        await user.click(screen.getByRole('button', { name: 'Generate summary' }));
        expect(onSummarize).toHaveBeenCalledTimes(2);

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });

    it('is a modal dialog that starts in the guidance field, keeps Tab inside and returns focus', async () => {
        const user = userEvent.setup();
        render(<SummaryHarness />);
        const opener = screen.getByRole('button', { name: 'Summarize' });
        await user.click(opener);

        const dialog = screen.getByRole('dialog', { name: 'Entry summary' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const closeIcon = screen.getAllByRole('button', { name: 'Close' })[0];
        const generate = screen.getByRole('button', { name: 'Generate summary' });
        expect(screen.getByLabelText('Emphasize')).toHaveFocus();

        generate.focus();
        await user.tab();
        expect(closeIcon).toHaveFocus();
        await user.tab({ shift: true });
        expect(generate).toHaveFocus();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
    });

    it('does not render while closed', () => {
        render(
            <EntrySummaryDialog
                entryId={12}
                isOpen={false}
                isDark
                onClose={onClose}
                onSummarize={vi.fn()}
                t={t}
            />,
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
