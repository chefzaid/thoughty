import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryContentRenderer from './EntryContentRenderer';
import { defaultProps, mockOnNavigateToEntry, waitForSelector } from './EntryContentRenderer.test-helpers';

describe('EntryContentRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Markdown rendering', () => {
        it('renders markdown content with bold text', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="This is **bold** text" format="markdown" />
            );

            const strong = await waitForSelector(container, 'strong');
            expect(strong?.textContent).toBe('bold');
        });

        it('renders markdown content with italic text', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="This is _italic_ text" format="markdown" />
            );

            const em = await waitForSelector(container, 'em');
            expect(em?.textContent).toBe('italic');
        });

        it('renders markdown headings', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="# Heading 1" format="markdown" />
            );

            const h1 = await waitForSelector(container, 'h1');
            expect(h1?.textContent).toBe('Heading 1');
        });

        it('renders markdown lists', async () => {
            const listContent = '- Item 1\n- Item 2\n- Item 3';
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content={listContent} format="markdown" />
            );

            await waitForSelector(container, 'ul');
        });

        it('renders markdown code blocks', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="```\nconst x = 1;\n```" format="markdown" />
            );

            await waitForSelector(container, 'code');
        });

        it('renders markdown inline code', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="Use `const` here" format="markdown" />
            );

            const code = await waitForSelector(container, 'code');
            expect(code?.textContent).toBe('const');
        });

        it('renders markdown blockquotes', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="> A wise quote" format="markdown" />
            );

            await waitForSelector(container, 'blockquote');
        });

        it('renders markdown links', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="[Click here](https://example.com)" format="markdown" />
            );

            const link = await waitForSelector(container, 'a');
            expect(link?.textContent).toBe('Click here');
            expect(link?.getAttribute('href')).toBe('https://example.com');
        });

        it('renders markdown strikethrough (GFM)', async () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="This is ~~deleted~~ text" format="markdown" />
            );

            const del = await waitForSelector(container, 'del');
            expect(del?.textContent).toBe('deleted');
        });

        it('renders markdown horizontal rule', () => {
            const hrContent = 'Above\n\n---\n\nBelow';
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content={hrContent} format="markdown" />
            );

            // react-markdown may render thematic break as hr
            expect(container.querySelector('.markdown-content')).toBeInTheDocument();
            expect(container.textContent).toContain('Above');
            expect(container.textContent).toContain('Below');
        });

        it('applies markdown-content class wrapper', () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="**bold**" format="markdown" />
            );

            expect(container.querySelector('.markdown-content')).toBeInTheDocument();
        });

        it('does not apply markdown-content class for plain format', () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="**not bold**" format="plain" />
            );

            expect(container.querySelector('.markdown-content')).not.toBeInTheDocument();
        });

        it('does not apply markdown-content class when format is undefined', () => {
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content="**not bold**" />
            );

            expect(container.querySelector('.markdown-content')).not.toBeInTheDocument();
        });

        it('renders cross-references inside markdown content', () => {
            render(
                <EntryContentRenderer
                    {...defaultProps}
                    content="See [[2026-01-10]] for **details**"
                    format="markdown"
                />
            );

            const refButton = screen.getByRole('button');
            expect(refButton).toHaveTextContent('[[2026-01-10]]');
        });

        it('renders markdown tables (GFM)', async () => {
            const tableContent = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content={tableContent} format="markdown" />
            );

            await waitForSelector(container, 'table');
        });

        it('handles maxLength truncation with markdown format', () => {
            const longContent = '**Bold text** followed by a lot more content that should be truncated';
            const { container } = render(
                <EntryContentRenderer {...defaultProps} content={longContent} format="markdown" maxLength={20} />
            );

            expect(container.querySelector('.markdown-content')).toBeInTheDocument();
            expect(container.textContent).toContain('...');
        });
    });

    describe('Markdown task lists', () => {
        const tasks = '# Errands\n\n- [ ] Call the bank\n- [x] Post the **letter**\n  - [ ] Nested';

        it('shows read-only task boxes named after their item when nothing can tick them', async () => {
            render(<EntryContentRenderer content={tasks} format="markdown" />);

            const call = await screen.findByRole('checkbox', { name: 'Call the bank' });
            const post = screen.getByRole('checkbox', { name: 'Post the letter' });
            expect(call).toBeDisabled();
            expect(call).not.toBeChecked();
            expect(post).toBeChecked();
            expect(screen.getByRole('checkbox', { name: 'Nested' })).toBeDisabled();
        });

        it('ticks a task by its line in the entry, without reaching the card', async () => {
            const user = userEvent.setup();
            const onToggleTask = vi.fn();
            const onCardClick = vi.fn();
            render(
                <div onClick={onCardClick}>
                    <EntryContentRenderer content={tasks} format="markdown" onToggleTask={onToggleTask} />
                </div>
            );

            await user.click(await screen.findByRole('checkbox', { name: 'Call the bank' }));
            await user.click(screen.getByRole('checkbox', { name: 'Post the letter' }));
            await user.click(screen.getByRole('checkbox', { name: 'Nested' }));

            expect(onToggleTask.mock.calls).toEqual([[2, true], [3, false], [4, true]]);
            expect(onCardClick).not.toHaveBeenCalled();
        });

        it('keeps the box focused when the tick changes the content', async () => {
            const user = userEvent.setup();
            const { rerender } = render(<EntryContentRenderer content="- [ ] One" format="markdown" onToggleTask={vi.fn()} />);

            const box = await screen.findByRole('checkbox', { name: 'One' });
            await user.click(box);
            rerender(<EntryContentRenderer content="- [x] One" format="markdown" onToggleTask={vi.fn()} />);

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'One' })).toBeChecked());
            expect(screen.getByRole('checkbox', { name: 'One' })).toBe(box);
            expect(box).toHaveFocus();
        });

        it('counts lines across cross-references and leaves a task that starts mid-line as it is', async () => {
            const onToggleTask = vi.fn();
            const user = userEvent.setup();
            render(
                <EntryContentRenderer
                    content={'See [[2024-01-15]]\n- [ ] After the link\n\nAlso [[2024-01-16]] - [ ] mid-line'}
                    format="markdown"
                    onNavigateToEntry={mockOnNavigateToEntry}
                    onToggleTask={onToggleTask}
                />
            );

            await user.click(await screen.findByRole('checkbox', { name: 'After the link' }));
            expect(onToggleTask).toHaveBeenCalledWith(1, true);
            expect(screen.getByRole('checkbox', { name: 'mid-line' })).toBeDisabled();
        });

        it('keeps task boxes while search matches are highlighted', async () => {
            render(<EntryContentRenderer content="- [ ] Call the bank" format="markdown" searchTerm="bank" onToggleTask={vi.fn()} />);

            expect(await screen.findByRole('checkbox', { name: 'Call the bank' })).toBeEnabled();
            expect(screen.getByText('bank').tagName).toBe('MARK');
        });

        it('leaves plain-text entries as text', () => {
            render(<EntryContentRenderer content="- [ ] Call the bank" format="plain" onToggleTask={vi.fn()} />);

            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
            expect(screen.getByText('- [ ] Call the bank')).toBeInTheDocument();
        });
    });
});
