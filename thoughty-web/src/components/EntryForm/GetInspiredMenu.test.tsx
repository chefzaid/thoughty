import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GetInspiredMenu from './GetInspiredMenu';

const translations: Record<string, string> = {
    getInspired: 'Get Inspired',
    getInspiredDescription: 'Get a reflective question based on your tags',
    inspirationTitle: 'A question for you',
    findingInspiration: 'Finding a question...',
    askAnotherQuestion: 'Ask another question',
    writeAboutThis: 'Write about this',
    inspirationError: 'Unable to find inspiration',
    retry: 'Retry',
};
const t = (key: string) => translations[key] ?? key;

describe('GetInspiredMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('asks, uses, and replaces a question', async () => {
        let resolveQuestion: (question: string) => void = () => {};
        const firstQuestion = new Promise<string>((resolve) => {
            resolveQuestion = resolve;
        });
        const onGenerate = vi.fn()
            .mockReturnValueOnce(firstQuestion)
            .mockResolvedValueOnce('What would you do if focus were easy?')
            .mockResolvedValueOnce('Where does your work feel meaningful?');
        const onSelect = vi.fn();
        const user = userEvent.setup();

        render(<GetInspiredMenu onGenerate={onGenerate} onSelect={onSelect} theme="dark" t={t} />);

        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
        expect(screen.getByText('Finding a question...')).toBeInTheDocument();
        resolveQuestion('What does protecting your focus cost you?');
        expect(await screen.findByText('What does protecting your focus cost you?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Ask another question' }));
        expect(await screen.findByText('What would you do if focus were easy?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Write about this' }));
        expect(onSelect).toHaveBeenCalledWith('What would you do if focus were easy?');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
        expect(await screen.findByText('Where does your work feel meaningful?')).toBeInTheDocument();
        expect(onGenerate).toHaveBeenCalledTimes(3);
    });

    it('shows a retryable error and closes on Escape', async () => {
        const onGenerate = vi.fn()
            .mockRejectedValueOnce(new Error('Network unavailable'))
            .mockResolvedValueOnce('What are you curious about today?');
        const user = userEvent.setup();

        render(<GetInspiredMenu onGenerate={onGenerate} onSelect={vi.fn()} theme="light" t={t} />);

        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to find inspiration');

        await user.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('What are you curious about today?')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('treats an empty response as an error', async () => {
        const user = userEvent.setup();
        render(<GetInspiredMenu onGenerate={vi.fn().mockResolvedValue('  ')} onSelect={vi.fn()} t={t} />);

        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('clears the cached question when the journal scope changes', async () => {
        const firstGenerator = vi.fn().mockResolvedValue('Question from diary one');
        const secondGenerator = vi.fn().mockResolvedValue('Question from diary two');
        const user = userEvent.setup();
        const { rerender } = render(
            <GetInspiredMenu onGenerate={firstGenerator} onSelect={vi.fn()} t={t} />,
        );

        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));
        expect(await screen.findByText('Question from diary one')).toBeInTheDocument();

        rerender(<GetInspiredMenu onGenerate={secondGenerator} onSelect={vi.fn()} t={t} />);
        await user.click(screen.getByRole('button', { name: 'Get Inspired' }));

        expect(await screen.findByText('Question from diary two')).toBeInTheDocument();
        expect(screen.queryByText('Question from diary one')).not.toBeInTheDocument();
        expect(secondGenerator).toHaveBeenCalledTimes(1);
    });
});
