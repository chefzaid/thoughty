import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { ICommand } from '@uiw/react-md-editor/commands';
import MarkdownEditor from './MarkdownEditor';
import MarkdownHelp from './MarkdownHelp';

vi.mock('@uiw/react-md-editor/nohighlight', () => ({
    default: ({ commands = [], className, style }: { commands?: ICommand[]; className?: string; style?: object }) => createElement(
        'div',
        { role: 'toolbar', className, style },
        commands
            .filter((command) => command.buttonProps?.['aria-label'])
            .map((command) => createElement('button', { key: command.name, type: 'button' }, command.buttonProps?.['aria-label'])),
    ),
}));

describe('MarkdownEditor', () => {
    it('gives the editor the toolbar with the task list button in the writer language', () => {
        render(<MarkdownEditor value="" t={(key) => (key === 'markdownTaskListButton' ? 'Ajouter une liste de tâches' : key)} />);

        expect(screen.getByRole('button', { name: 'Ajouter une liste de tâches' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'markdownHelpButton' })).toBeInTheDocument();
    });

    it('hands the writer’s spacing to the editor as custom properties, beside its own class and style', () => {
        render(<MarkdownEditor value="" t={(key) => key} className="mine" style={{ minHeight: '10px' }} spacing={{ lineSpacing: 'loose', letterSpacing: 'wide' }} />);

        const editor = screen.getByRole('toolbar');
        expect(editor).toHaveClass('entry-text-spacing', 'mine');
        expect(editor.style.minHeight).toBe('10px');
        expect(editor.style.getPropertyValue('--entry-line-height')).toBe('2.2');
        expect(editor.style.getPropertyValue('--entry-letter-spacing')).toBe('0.06em');
    });

    it('sets no spacing properties when the writer keeps normal spacing', () => {
        render(<MarkdownEditor value="" t={(key) => key} />);

        const editor = screen.getByRole('toolbar');
        expect(editor).toHaveClass('entry-text-spacing');
        expect(editor.style.getPropertyValue('--entry-line-height')).toBe('');
    });
});

describe('MarkdownHelp', () => {
    it('opens a short reference that includes task lists', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="light" t={(key) => key} />);

        expect(screen.getByText('markdownHelpTask')).not.toBeVisible();
        await user.click(screen.getByText('markdownHelpSummary'));

        expect(screen.getByText('- [ ] …')).toBeVisible();
        expect(screen.getByText('markdownHelpTask')).toBeVisible();
        expect(screen.getByText('- [x] …')).toBeVisible();
        expect(screen.getByText('markdownHelpTaskDone')).toBeVisible();
        expect(screen.getByText('![…](attachment:12)')).toBeVisible();
        expect(screen.getByText('markdownHelpInlineImage')).toBeVisible();
    });
});
