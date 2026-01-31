import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagPicker from './TagPicker';

describe('TagPicker', () => {
    const defaultProps = {
        availableTags: ['work', 'personal', 'ideas'],
        selectedTags: [] as string[],
        onChange: vi.fn(),
        allowNew: true,
        placeholder: 'Add tags...',
        singleSelect: false,
        theme: 'dark' as const
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders with placeholder when no tags selected', () => {
            render(<TagPicker {...defaultProps} />);

            const input = screen.getByPlaceholderText('Add tags...');
            expect(input).toBeInTheDocument();
        });

        it('renders selected tags', () => {
            render(<TagPicker {...defaultProps} selectedTags={['work', 'personal']} />);

            expect(screen.getByText('work')).toBeInTheDocument();
            expect(screen.getByText('personal')).toBeInTheDocument();
        });

        it('hides placeholder when tags are selected', () => {
            render(<TagPicker {...defaultProps} selectedTags={['work']} />);

            const input = screen.getByRole('textbox');
            expect(input).not.toHaveAttribute('placeholder', 'Add tags...');
        });

        it('applies light theme styles', () => {
            render(<TagPicker {...defaultProps} theme="light" />);

            const container = screen.getByRole('textbox').parentElement;
            expect(container).toHaveClass('bg-gray-50');
        });

        it('applies dark theme styles', () => {
            render(<TagPicker {...defaultProps} theme="dark" />);

            const container = screen.getByRole('textbox').parentElement;
            expect(container).toHaveClass('bg-gray-900');
        });
    });

    describe('Dropdown behavior', () => {
        it('opens dropdown on focus', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} />);

            const input = screen.getByRole('textbox');
            await user.click(input);

            expect(screen.getByText('work')).toBeInTheDocument();
            expect(screen.getByText('personal')).toBeInTheDocument();
        });

        it('filters tags based on input', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'wo');

            expect(screen.getByText('work')).toBeInTheDocument();
            expect(screen.queryByText('personal')).not.toBeInTheDocument();
        });

        it('closes dropdown on outside click', async () => {
            const user = userEvent.setup();
            render(
                <div>
                    <TagPicker {...defaultProps} />
                    <button>Outside</button>
                </div>
            );

            const input = screen.getByRole('textbox');
            await user.click(input);
            expect(screen.getByText('work')).toBeInTheDocument();

            await user.click(screen.getByText('Outside'));
            // Dropdown should be closed - tags list should not be visible as dropdown items
            expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
        });

        it('shows "No tags found" when no matches', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} allowNew={false} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'xyz');

            expect(screen.getByText('No tags found')).toBeInTheDocument();
        });
    });

    describe('Tag selection', () => {
        it('selects a tag from dropdown', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} />);

            const input = screen.getByRole('textbox');
            await user.click(input);
            await user.click(screen.getByText('work'));

            expect(onChange).toHaveBeenCalledWith(['work']);
        });

        it('does not show already selected tags in dropdown', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} selectedTags={['work']} />);

            const input = screen.getByRole('textbox');
            await user.click(input);

            // 'work' should not be in the dropdown since it's already selected
            const dropdownItems = screen.getAllByRole('listitem');
            const dropdownTexts = dropdownItems.map(item => item.textContent);
            expect(dropdownTexts).not.toContain('work');
        });

        it('handles single select mode', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} singleSelect={true} />);

            const input = screen.getByRole('textbox');
            await user.click(input);
            await user.click(screen.getByText('work'));

            expect(onChange).toHaveBeenCalledWith(['work']);
        });
    });

    describe('Tag creation', () => {
        it('shows create option for new tag', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'newtag');

            expect(screen.getByText('Create "newtag"')).toBeInTheDocument();
        });

        it('creates new tag when clicking create option', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'newtag');
            await user.click(screen.getByText('Create "newtag"'));

            expect(onChange).toHaveBeenCalledWith(['newtag']);
        });

        it('does not show create option when allowNew is false', async () => {
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} allowNew={false} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'newtag');

            expect(screen.queryByText('Create "newtag"')).not.toBeInTheDocument();
        });

        it('does not create duplicate tags', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} selectedTags={['existing']} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'existing');
            await user.keyboard('{Enter}');

            // onChange should not be called since tag already exists
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('Tag removal', () => {
        it('removes tag when clicking remove button', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} selectedTags={['work', 'personal']} />);

            // Find the remove button (×) for 'work' tag
            const workTag = screen.getByText('work').parentElement;
            const removeButton = workTag?.querySelector('button');
            if (removeButton) {
                await user.click(removeButton);
                expect(onChange).toHaveBeenCalledWith(['personal']);
            }
        });
    });

    describe('Keyboard navigation', () => {
        it('selects existing tag on Enter', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'work');
            await user.keyboard('{Enter}');

            expect(onChange).toHaveBeenCalledWith(['work']);
        });

        it('creates new tag on Enter when no exact match', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} />);

            const input = screen.getByRole('textbox');
            await user.type(input, 'brandnew');
            await user.keyboard('{Enter}');

            expect(onChange).toHaveBeenCalledWith(['brandnew']);
        });

        it('removes last tag on Backspace when input is empty', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<TagPicker {...defaultProps} onChange={onChange} selectedTags={['work', 'personal']} />);

            const input = screen.getByRole('textbox');
            await user.click(input);
            await user.keyboard('{Backspace}');

            expect(onChange).toHaveBeenCalledWith(['work']);
        });
    });
});
