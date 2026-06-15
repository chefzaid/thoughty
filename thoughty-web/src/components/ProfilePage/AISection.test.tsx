import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AISection from './AISection';

const mockFetchModels = vi.fn();

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({
        aiService: { fetchModels: mockFetchModels },
    }),
}));

const mockT = (key: string): string => key;
const mockHandleChange = vi.fn();

const mockModels = [
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'meta/llama-3', name: 'Llama 3' },
];

describe('AISection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchModels.mockReturnValue(new Promise(() => {}));
    });

    it('renders all AI settings fields', async () => {
        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(mockFetchModels).toHaveBeenCalled();
        });

        expect(screen.getByText('aiConfiguration')).toBeInTheDocument();
        expect(screen.getByText('openRouterModel')).toBeInTheDocument();
        expect(screen.getByText('autoTagMaxTags')).toBeInTheDocument();
        expect(screen.getByText('openRouterTaskModels')).toBeInTheDocument();
        expect(screen.getByText('openRouterTaskModelsDescription')).toBeInTheDocument();
        expect(screen.getByText('openRouterTagModel')).toBeInTheDocument();
        expect(screen.getByText('openRouterWritingModel')).toBeInTheDocument();
        expect(screen.getByText('openRouterChatModel')).toBeInTheDocument();
        expect(screen.getByText('openRouterToneModel')).toBeInTheDocument();
        expect(screen.getByText('openRouterBookModel')).toBeInTheDocument();
    });

    it('shows text input for model when models have not loaded', async () => {
        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(mockFetchModels).toHaveBeenCalled();
        });

        const modelInput = screen.getByPlaceholderText('openai/gpt-4o-mini');
        expect(modelInput).toBeInTheDocument();
        expect(modelInput.tagName).toBe('INPUT');
        expect(screen.getAllByPlaceholderText('inheritDefaultModel')).toHaveLength(5);
    });

    it('fetches models on mount', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(mockFetchModels).toHaveBeenCalled();
        });
    });

    it('shows dropdown trigger when models are loaded', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            const trigger = screen.getByText('openai/gpt-4o-mini');
            expect(trigger).toBeInTheDocument();
        });
    });

    it('opens dropdown and shows models when trigger is clicked', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('openai/gpt-4o-mini'));

        const dropdownList = document.querySelector('.model-dropdown-list') as HTMLElement;
        expect(within(dropdownList).getByText('GPT-4o')).toBeInTheDocument();
        expect(within(dropdownList).getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
        expect(within(dropdownList).getByText('Llama 3')).toBeInTheDocument();
    });

    it('selects a model when clicked in dropdown', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('openai/gpt-4o-mini'));
        const dropdownList = document.querySelector('.model-dropdown-list') as HTMLElement;
        fireEvent.click(within(dropdownList).getByRole('button', { name: /GPT-4o/ }));

        expect(mockHandleChange).toHaveBeenCalledWith({
            target: { name: 'openRouterModel', value: 'openai/gpt-4o' },
        });
    });

    it('selects task-specific models from loaded model options', async () => {
        mockFetchModels.mockResolvedValue(mockModels);
        const changes: Array<{ name: string; value: string }> = [];
        const handleChange = vi.fn((event) => {
            changes.push({ name: event.target.name, value: event.target.value });
        });

        render(
            <AISection
                localConfig={{ theme: 'dark', openRouterTagModel: '' }}
                handleChange={handleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
        });

        const tagModelSelect = screen.getByLabelText('openRouterTagModel');
        fireEvent.change(tagModelSelect, { target: { value: 'meta/llama-3' } });

        expect(handleChange).toHaveBeenCalled();
        expect(changes.at(-1)).toEqual({
            name: 'openRouterTagModel',
            value: 'meta/llama-3',
        });
    });

    it('filters models by search text', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('openai/gpt-4o-mini'));

        const searchInput = screen.getByPlaceholderText('searchModels');
        fireEvent.change(searchInput, { target: { value: 'claude' } });

        const dropdownList = document.querySelector('.model-dropdown-list') as HTMLElement;
        expect(within(dropdownList).getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
        expect(within(dropdownList).queryByText('GPT-4o')).not.toBeInTheDocument();
        expect(within(dropdownList).queryByText('Llama 3')).not.toBeInTheDocument();
    });

    it('shows no models found when search has no results', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('openai/gpt-4o-mini'));

        const searchInput = screen.getByPlaceholderText('searchModels');
        fireEvent.change(searchInput, { target: { value: 'nonexistent-model' } });

        expect(screen.getByText('noModelsFound')).toBeInTheDocument();
    });

    it('displays selected model name when a model is configured', async () => {
        mockFetchModels.mockResolvedValue(mockModels);

        render(
            <AISection
                localConfig={{ theme: 'dark', openRouterModel: 'anthropic/claude-3.5-sonnet' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Claude 3.5 Sonnet/ })).toBeInTheDocument();
        });
    });

    it('renders with light theme', async () => {
        render(
            <AISection
                localConfig={{ theme: 'light' }}
                handleChange={mockHandleChange}
                t={mockT}
            />
        );

        await waitFor(() => {
            expect(mockFetchModels).toHaveBeenCalled();
        });

        const modelInput = screen.getByPlaceholderText('openai/gpt-4o-mini');
        expect(modelInput).toHaveClass('light');
    });
});
