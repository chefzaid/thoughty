import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';

describe('ProfilePage', () => {
    const defaultProps = {
        config: {
            name: 'John Doe',
            theme: 'dark',
            entriesPerPage: '10',
            language: 'en',
            defaultVisibility: 'private'
        },
        onUpdateConfig: vi.fn(),
        onBack: vi.fn(),
        t: (key, params = {}) => {
            if (key === 'memberSince') return `Member since ${params.year}`;
            return key;
        },
        stats: {
            totalEntries: 42,
            uniqueTags: 15,
            firstEntryYear: 2023
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the profile page with title', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getByText('profile')).toBeInTheDocument();
        });

        it('displays profile name input with current value', () => {
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            expect(input).toBeInTheDocument();
        });

        it('displays user initial in avatar', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getAllByText('J')[0]).toBeInTheDocument();
        });

        it('displays current theme state', () => {
            render(<ProfilePage {...defaultProps} />);
            
            const toggle = screen.getByLabelText('Toggle theme');
            expect(toggle).toBeInTheDocument();
            expect(toggle).toHaveClass('dark');
        });

        it('renders Cancel and Save buttons', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getByText('cancel')).toBeInTheDocument();
            expect(screen.getByText('saveSettings')).toBeInTheDocument();
        });

        it('renders back button', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getByText('back')).toBeInTheDocument();
        });

        it('renders section headers', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getByText('personalInfo')).toBeInTheDocument();
            expect(screen.getByText('appearance')).toBeInTheDocument();
            expect(screen.getByText('preferences')).toBeInTheDocument();
        });

        it('displays member since year', () => {
            render(<ProfilePage {...defaultProps} />);

            expect(screen.getByText('Member since 2023')).toBeInTheDocument();
        });

        it('displays email input field', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, email: 'john@example.com' }} />);

            const input = screen.getByDisplayValue('john@example.com');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('type', 'email');
        });

        it('displays bio textarea field', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, bio: 'Hello world' }} />);

            const textarea = screen.getByDisplayValue('Hello world');
            expect(textarea).toBeInTheDocument();
            expect(textarea.tagName.toLowerCase()).toBe('textarea');
        });

        it('displays location input field', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, location: 'Paris, France' }} />);

            const input = screen.getByDisplayValue('Paris, France');
            expect(input).toBeInTheDocument();
        });
    });

    describe('Form interactions', () => {
        it('updates profile name on input change', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'Jane Smith');

            expect(input.value).toBe('Jane Smith');
        });

        it('toggles theme on button click', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, theme: 'light' }} />);

            const toggle = screen.getByLabelText('Toggle theme');
            expect(toggle).toHaveClass('light');

            await user.click(toggle);

            expect(toggle).toHaveClass('dark');
        });

        it('updates entries per page', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const select = screen.getByRole('combobox');
            await user.selectOptions(select, '25');

            expect(select.value).toBe('25');
        });

        it('updates language on click', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const frBtn = screen.getByTitle('Français');
            await user.click(frBtn);

            expect(frBtn).toHaveClass('active');
        });
    });

    describe('Actions', () => {
        it('calls onBack when back button is clicked', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            await user.click(screen.getByText('back'));

            expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
        });

        it('calls onBack when cancel button is clicked', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            await user.click(screen.getByText('cancel'));

            expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
        });

        it('calls onUpdateConfig and onBack when save is clicked', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            await user.click(screen.getByText('saveSettings'));

            expect(defaultProps.onUpdateConfig).toHaveBeenCalledTimes(1);
            expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
        });

        it('saves updated config values', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'Jane');
            await user.click(screen.getByText('saveSettings'));

            expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'Jane' })
            );
        });
    });

    describe('Avatar', () => {
        it('handles missing name with default', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, name: undefined }} />);

            expect(screen.getAllByText('U')[0]).toBeInTheDocument();
        });

        it('handles empty string name', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, name: '' }} />);

            expect(screen.getAllByText('U')[0]).toBeInTheDocument();
        });

        it('capitalizes the initial', () => {
            render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, name: 'john' }} />);

            expect(screen.getAllByText('J')[0]).toBeInTheDocument();
        });
    });
});
