import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkdownHelp from './MarkdownHelp';

describe('MarkdownHelp', () => {
    const mockT = (key: string) => {
        const translations: Record<string, string> = {
            markdownHelp: 'Markdown syntax help',
            markdownHelpSyntax: 'Syntax',
            markdownHelpResult: 'Result',
            markdownHelpShortcut: 'Shortcut',
            bold: 'Bold',
            italic: 'Italic',
            strikethrough: 'Strikethrough',
            heading1: 'Heading 1',
            heading2: 'Heading 2',
            heading3: 'Heading 3',
            bulletList: 'Bullet list',
            numberedList: 'Numbered list',
            blockquote: 'Blockquote',
            inlineCode: 'Inline code',
            codeBlock: 'Code block',
            link: 'Link',
            horizontalRule: 'Horizontal rule',
        };
        return translations[key] || key;
    };

    it('renders help button', () => {
        render(<MarkdownHelp theme="dark" t={mockT} />);

        expect(screen.getByTitle('Markdown syntax help')).toBeInTheDocument();
    });

    it('does not show popover by default', () => {
        render(<MarkdownHelp theme="dark" t={mockT} />);

        expect(screen.queryByText('Syntax')).not.toBeInTheDocument();
    });

    it('shows popover when help button is clicked', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="dark" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));

        expect(screen.getByText('Syntax')).toBeInTheDocument();
        expect(screen.getByText('Result')).toBeInTheDocument();
        expect(screen.getByText('Shortcut')).toBeInTheDocument();
    });

    it('shows markdown syntax entries in popover', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="dark" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));

        expect(screen.getByText('**bold**')).toBeInTheDocument();
        expect(screen.getByText('_italic_')).toBeInTheDocument();
        expect(screen.getByText('# Heading 1')).toBeInTheDocument();
    });

    it('shows keyboard shortcuts', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="dark" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));

        expect(screen.getByText('Ctrl+B')).toBeInTheDocument();
        expect(screen.getByText('Ctrl+I')).toBeInTheDocument();
    });

    it('closes popover when clicked again', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="dark" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));
        expect(screen.getByText('Syntax')).toBeInTheDocument();

        await user.click(screen.getByTitle('Markdown syntax help'));
        expect(screen.queryByText('Syntax')).not.toBeInTheDocument();
    });

    it('renders with light theme styles', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="light" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));

        const popover = screen.getByText('Syntax').closest('div');
        expect(popover).toHaveClass('bg-white');
    });

    it('renders with dark theme styles', async () => {
        const user = userEvent.setup();
        render(<MarkdownHelp theme="dark" t={mockT} />);

        await user.click(screen.getByTitle('Markdown syntax help'));

        const popover = screen.getByText('Markdown syntax help').closest('div.absolute');
        expect(popover).toHaveClass('bg-gray-800');
    });
});
