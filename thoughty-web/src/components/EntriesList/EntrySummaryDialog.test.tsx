import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from './EntriesList.test-utils';
import EntrySummaryDialog from './EntrySummaryDialog';

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
