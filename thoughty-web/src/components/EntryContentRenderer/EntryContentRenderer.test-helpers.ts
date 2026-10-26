import { expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';

export const mockOnNavigateToEntry = vi.fn();

/** The props every `EntryContentRenderer` spec starts from: no content, dark theme, English. */
export const defaultProps = {
    content: '',
    onNavigateToEntry: mockOnNavigateToEntry,
    theme: 'dark' as const,
    t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params),
};

/** Waits until `selector` matches inside `container` (Markdown renders lazily) and returns the match. */
export const waitForSelector = async (container: HTMLElement, selector: string): Promise<Element> => {
    await waitFor(() => {
        expect(container.querySelector(selector)).toBeInTheDocument();
    });

    return container.querySelector(selector) as Element;
};
