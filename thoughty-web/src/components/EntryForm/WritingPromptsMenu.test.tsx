import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WritingPromptsMenu from './WritingPromptsMenu';

const translations: Record<string, string> = {
    writingPrompts: 'Writing prompts',
    chooseWritingPrompt: 'Choose a prompt',
    generatingWritingPrompts: 'Finding a fresh direction...',
    regenerateWritingPrompts: 'Regenerate prompts',
    writingPromptsError: 'Unable to generate prompts',
    retry: 'Retry',
};
const t = (key: string) => translations[key] ?? key;

describe('WritingPromptsMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generates, selects, and regenerates prompts', async () => {
        let resolveInitialPrompts: (prompts: string[]) => void = () => {};
        const initialPrompts = new Promise<string[]>((resolve) => {
            resolveInitialPrompts = resolve;
        });
        const onGenerate = vi.fn()
            .mockReturnValueOnce(initialPrompts)
            .mockResolvedValueOnce(['What deserves a fresh perspective?']);
        const onSelect = vi.fn();
        const user = userEvent.setup();

        render(
            <WritingPromptsMenu
                onGenerate={onGenerate}
                onSelect={onSelect}
                theme="dark"
                t={t}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));
        expect(screen.getByText('Finding a fresh direction...')).toBeInTheDocument();
        resolveInitialPrompts([
            'What helps you protect creative focus?',
            'Which lesson still feels unfinished?',
        ]);
        await user.click(await screen.findByRole('menuitem', {
            name: 'What helps you protect creative focus?',
        }));

        expect(onSelect).toHaveBeenCalledWith('What helps you protect creative focus?');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));
        await user.click(screen.getByRole('button', { name: 'Regenerate prompts' }));
        expect(await screen.findByRole('menuitem', {
            name: 'What deserves a fresh perspective?',
        })).toBeInTheDocument();
        expect(onGenerate).toHaveBeenCalledTimes(2);
    });

    it('shows a retryable error and closes on Escape', async () => {
        const onGenerate = vi.fn()
            .mockRejectedValueOnce(new Error('Network unavailable'))
            .mockResolvedValueOnce(['What are you curious about today?']);
        const user = userEvent.setup();

        render(
            <WritingPromptsMenu
                onGenerate={onGenerate}
                onSelect={vi.fn()}
                theme="light"
                t={t}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to generate prompts');

        await user.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('What are you curious about today?')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('treats an empty response as an error', async () => {
        const user = userEvent.setup();
        render(
            <WritingPromptsMenu
                onGenerate={vi.fn().mockResolvedValue([])}
                onSelect={vi.fn()}
                t={t}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('clears cached prompts when the journal scope changes', async () => {
        const firstGenerator = vi.fn().mockResolvedValue(['Prompt from diary one']);
        const secondGenerator = vi.fn().mockResolvedValue(['Prompt from diary two']);
        const user = userEvent.setup();
        const { rerender } = render(
            <WritingPromptsMenu
                onGenerate={firstGenerator}
                onSelect={vi.fn()}
                t={t}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));
        expect(await screen.findByText('Prompt from diary one')).toBeInTheDocument();

        rerender(
            <WritingPromptsMenu
                onGenerate={secondGenerator}
                onSelect={vi.fn()}
                t={t}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Writing prompts' }));

        expect(await screen.findByText('Prompt from diary two')).toBeInTheDocument();
        expect(screen.queryByText('Prompt from diary one')).not.toBeInTheDocument();
        expect(secondGenerator).toHaveBeenCalledTimes(1);
    });
});
