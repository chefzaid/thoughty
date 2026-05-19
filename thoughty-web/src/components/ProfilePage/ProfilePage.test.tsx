import { type ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';

vi.mock('./AISection', () => ({
    default: ({ localConfig, handleChange }: { localConfig: { autoTagMaxTags?: string; theme?: 'light' | 'dark' }; handleChange: (event: { target: { name: string; value: string } }) => void }) => (
        <div>
            <div>aiConfiguration</div>
            <input
                type="number"
                name="autoTagMaxTags"
                value={localConfig.autoTagMaxTags ?? '0'}
                onChange={(event) => handleChange({ target: { name: 'autoTagMaxTags', value: event.target.value } })}
                className={localConfig.theme === 'light' ? 'light' : 'dark'}
            />
        </div>
    ),
}));

vi.mock('./CloudProvidersSection', () => ({
    default: () => <div>cloudProviders</div>,
}));

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'test-user', name: 'John Doe', email: 'john@example.com', authProvider: 'local' },
        changePassword: vi.fn().mockResolvedValue({ success: true }),
        deleteAccount: vi.fn().mockResolvedValue({ success: true })
    })
}));

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({
        cloudSyncService: {
            getStatus: vi.fn().mockResolvedValue({}),
            getAuthUrl: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            listFiles: vi.fn(),
            uploadExport: vi.fn(),
            downloadFile: vi.fn(),
            getSchedules: vi.fn(),
            setSchedule: vi.fn(),
            deleteSchedule: vi.fn(),
            triggerSync: vi.fn(),
        },
        aiService: {
            fetchModels: vi.fn().mockResolvedValue([]),
        },
    }),
}));

describe('ProfilePage', () => {
    const defaultProps: ComponentProps<typeof ProfilePage> = {
        config: {
            name: 'John Doe',
            theme: 'dark',
            entriesPerPage: '10',
            language: 'en',
            defaultVisibility: 'private',
            autoTagMaxTags: '0'
        },
        allTags: ['focus', 'reflection'],
        onUpdateConfig: vi.fn(),
        onDownloadData: vi.fn().mockResolvedValue(true),
        onBack: vi.fn(),
        t: (key: string, params: Record<string, string | number> = {}): string => {
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
            expect(screen.getByText('cloudProviders')).toBeInTheDocument();
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

        it('displays gender input field', () => {
            const { container } = render(<ProfilePage {...defaultProps} config={{ ...defaultProps.config, gender: 'male' }} />);

            const input = container.querySelector('select[name="gender"]') as HTMLSelectElement;
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('name', 'gender');
            expect(input.value).toBe('male');
        });
    });

    describe('Form interactions', () => {
        it('updates profile name on input change', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'Jane Smith');

            expect((input as HTMLInputElement).value).toBe('Jane Smith');
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
            const { container } = render(<ProfilePage {...defaultProps} />);

            const select = container.querySelector('select[name="entriesPerPage"]') as HTMLSelectElement;
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

        it('updates the automatic tag limit', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('0');
            await user.clear(input);
            await user.type(input, '3');

            expect((input as HTMLInputElement).value).toBe('3');
        });

        it('calls onDownloadData when download button is clicked', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: 'downloadMyData' }));

            expect(defaultProps.onDownloadData).toHaveBeenCalledTimes(1);
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

        it('calls onUpdateConfig when save is clicked', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            await user.click(screen.getByText('saveSettings'));

            expect(defaultProps.onUpdateConfig).toHaveBeenCalledTimes(1);
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

        it('saves the automatic tag limit', async () => {
            const user = userEvent.setup();
            render(<ProfilePage {...defaultProps} />);

            const input = screen.getByDisplayValue('0');
            await user.clear(input);
            await user.type(input, '4');
            await user.click(screen.getByText('saveSettings'));

            expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith(
                expect.objectContaining({ autoTagMaxTags: '4' })
            );
        });

        it('saves updated gender', async () => {
            const user = userEvent.setup();
            const { container } = render(<ProfilePage {...defaultProps} />);

            const input = container.querySelector('select[name="gender"]') as HTMLSelectElement;
            await user.selectOptions(input, 'other');
            await user.click(screen.getByText('saveSettings'));

            expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith(
                expect.objectContaining({ gender: 'other' })
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
