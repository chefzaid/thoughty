import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import EntryContentRenderer from './EntryContentRenderer';
import { defaultProps } from './EntryContentRenderer.test-helpers';

describe('EntryContentRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
