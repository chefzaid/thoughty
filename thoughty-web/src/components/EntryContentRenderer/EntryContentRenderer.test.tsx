import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import EntryContentRenderer from './EntryContentRenderer';

describe('EntryContentRenderer', () => {
    const mockOnNavigateToEntry = vi.fn();

    const defaultProps = {
        content: '',
        onNavigateToEntry: mockOnNavigateToEntry,
        theme: 'dark' as const,
        t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const waitForSelector = async (container: HTMLElement, selector: string): Promise<Element> => {
        await waitFor(() => {
            expect(container.querySelector(selector)).toBeInTheDocument();
        });

        return container.querySelector(selector) as Element;
    };

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
            const { container } = render(<EntryContentRenderer {...defaultProps} content={null as unknown as string} />);
            expect(container.textContent).toBe('');
        });
    });

    describe('Cross-reference detection', () => {
        it('detects [[yyyy-mm-dd]] format', () => {
            render(<EntryContentRenderer {...defaultProps} content="See [[2026-01-10]] for more" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('[[2026-01-10]]');
            expect(link).toHaveClass('entry-reference-link');
        });

        it('renders references as plain text when there is nowhere to navigate', () => {
            render(<EntryContentRenderer content="See [[2026-01-10]] for more" />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.getByText('[[2026-01-10]]')).toHaveClass('entry-reference-link');
        });

        it('detects [[yyyy-mm-dd#X]] format', () => {
            render(<EntryContentRenderer {...defaultProps} content="Check [[2026-01-10#2]]" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('[[2026-01-10#2]]');
        });

        it('detects multiple references in same content', () => {
            render(<EntryContentRenderer
                {...defaultProps}
                content="See [[2026-01-10]] and [[2025-12-25#3]] for details"
            />);

            const links = screen.getAllByRole('button');
            expect(links).toHaveLength(2);
            expect(links[0]).toHaveTextContent('[[2026-01-10]]');
            expect(links[1]).toHaveTextContent('[[2025-12-25#3]]');
        });

        it('keeps compatibility with entry (...) references', () => {
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
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10]]" />);

            await user.click(screen.getByRole('button'));

            expect(mockOnNavigateToEntry).toHaveBeenCalledWith('2026-01-10', 1, undefined);
        });

        it('calls onNavigateToEntry with date and index on click', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10#5]]" />);

            await user.click(screen.getByRole('button'));

            expect(mockOnNavigateToEntry).toHaveBeenCalledWith('2026-01-10', 5, undefined);
        });

        it('handles Enter key for accessibility', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10]]" />);

            const link = screen.getByRole('button');
            link.focus();
            await user.keyboard('{Enter}');

            expect(mockOnNavigateToEntry).toHaveBeenCalled();
        });

        it('handles Space key for accessibility', async () => {
            const user = userEvent.setup();
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10]]" />);

            const link = screen.getByRole('button');
            link.focus();
            await user.keyboard(' ');

            expect(mockOnNavigateToEntry).toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('does not match invalid date formats', () => {
            render(<EntryContentRenderer {...defaultProps} content="[[2026-1-10]] is invalid" />);

            // Should not create a link for invalid format
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.getByText(/\[\[2026-1-10\]\] is invalid/)).toBeInTheDocument();
        });

        it('handles reference at start of content', () => {
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10]] starts this" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('[[2026-01-10]]');
        });

        it('handles reference at end of content', () => {
            render(<EntryContentRenderer {...defaultProps} content="This ends with [[2026-01-10]]" />);

            const link = screen.getByRole('button');
            expect(link).toHaveTextContent('[[2026-01-10]]');
        });

        it('shows tooltip with navigation info', () => {
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10#2]]" />);

            const link = screen.getByRole('button');
            expect(link).toHaveAttribute('title', 'Navigate to entry on 2026-01-10 (#2)');
        });

        it('shows the tooltip in French', () => {
            render(<EntryContentRenderer {...defaultProps} content="[[2026-01-10]]" t={(key, params) => getTranslation('fr', key, params)} />);

            expect(screen.getByRole('button')).toHaveAttribute('title', "Aller à l'entrée du 2026-01-10");
        });
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

    describe('Search highlighting', () => {
        describe('Plain text highlighting', () => {
            it('highlights matching text with <mark> tags', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello world, welcome to the world" searchTerm="world" />
                );

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(2);
                expect(marks[0]!.textContent).toBe('world');
                expect(marks[1]!.textContent).toBe('world');
            });

            it('highlights are case-insensitive', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello World, hello WORLD" searchTerm="world" />
                );

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(2);
            });

            it('applies highlight CSS classes', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello world" searchTerm="world" />
                );

                const mark = container.querySelector('mark');
                expect(mark).toBeInTheDocument();
                expect(mark).toHaveClass('search-highlight');
            });

            it('does not highlight when searchTerm is empty', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello world" searchTerm="" />
                );

                expect(container.querySelectorAll('mark')).toHaveLength(0);
            });

            it('does not highlight when searchTerm is undefined', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello world" />
                );

                expect(container.querySelectorAll('mark')).toHaveLength(0);
            });

            it('handles no matches gracefully', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Hello world" searchTerm="xyz" />
                );

                expect(container.querySelectorAll('mark')).toHaveLength(0);
                expect(container.textContent).toBe('Hello world');
            });

            it('escapes special regex characters in search term', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Price is $5.00 total" searchTerm="$5.00" />
                );

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(1);
                expect(marks[0]!.textContent).toBe('$5.00');
            });

            it('preserves surrounding text around highlights', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="before match after" searchTerm="match" />
                );

                expect(container.textContent).toBe('before match after');
                expect(container.querySelectorAll('mark')).toHaveLength(1);
            });
        });

        describe('Server search matches', () => {
            it('highlights the matched words and phrases as whole words', () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="A morning run, then running past the brunch place."
                        searchTerm='"morning run" runn'
                        searchMatches={['morning run', 'running']}
                    />
                );

                const marks = [...container.querySelectorAll('mark')].map((mark) => mark.textContent);
                expect(marks).toEqual(['morning run', 'running']);
            });

            it('highlights nothing when only a tag matched', () => {
                const { container } = render(
                    <EntryContentRenderer {...defaultProps} content="Family dinner" searchTerm="families" searchMatches={[]} />
                );

                expect(container.querySelectorAll('mark')).toHaveLength(0);
            });

            it('highlights server matches inside markdown', async () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="Walking **walks** daily"
                        format="markdown"
                        searchTerm="walk"
                        searchMatches={['Walking', 'walks']}
                    />
                );

                await waitFor(() => {
                    expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['Walking', 'walks']);
                });
            });
        });

        describe('Highlighting with cross-references', () => {
            it('highlights text parts but not cross-references', () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="Check this world [[2026-01-10]] for world details"
                        searchTerm="world"
                    />
                );

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(2);
            });
        });

        describe('Markdown highlighting', () => {
            it('highlights text inside markdown paragraphs', async () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="This is a test paragraph"
                        format="markdown"
                        searchTerm="test"
                    />
                );

                await waitFor(() => {
                    expect(container.querySelectorAll('mark')).toHaveLength(1);
                });

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(1);
                expect(marks[0]!.textContent).toBe('test');
            });

            it('highlights text inside bold markdown', async () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="This is **bold test** content"
                        format="markdown"
                        searchTerm="test"
                    />
                );

                await waitFor(() => {
                    expect(container.querySelectorAll('mark')).toHaveLength(1);
                });

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(1);
                expect(marks[0]!.textContent).toBe('test');
            });

            it('highlights text inside italic markdown', async () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="This is _italic test_ content"
                        format="markdown"
                        searchTerm="test"
                    />
                );

                await waitFor(() => {
                    expect(container.querySelectorAll('mark')).toHaveLength(1);
                });

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(1);
            });

            it('highlights text inside list items', async () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="- item one test\n- item two test"
                        format="markdown"
                        searchTerm="test"
                    />
                );

                await waitFor(() => {
                    expect(container.querySelectorAll('mark')).toHaveLength(2);
                });

                const marks = container.querySelectorAll('mark');
                expect(marks).toHaveLength(2);
            });

            it('does not highlight when searchTerm is empty in markdown', () => {
                const { container } = render(
                    <EntryContentRenderer
                        {...defaultProps}
                        content="This is a **test** paragraph"
                        format="markdown"
                        searchTerm=""
                    />
                );

                expect(container.querySelectorAll('mark')).toHaveLength(0);
            });
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
