import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryContentRenderer from './EntryContentRenderer';
import { defaultProps } from './EntryContentRenderer.test-helpers';
import type { Attachment } from '../../types';

const authFetch = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ authFetch }),
}));

const attachment = (id: number, name: string, mimetype = 'image/png'): Attachment => ({
    id,
    entry_id: 1,
    original_filename: name,
    stored_filename: `stored-${id}.png`,
    mimetype,
    size: 2048,
    created_at: '2024-01-01T00:00:00Z',
} as Attachment);

const attachments = [attachment(5, 'pier.png'), attachment(6, 'notes.pdf', 'application/pdf')];

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

describe('EntryContentRenderer inline images', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Only the object URL calls are replaced: React Markdown builds URLs of its own
        URL.createObjectURL = vi.fn(() => 'blob:pier');
        URL.revokeObjectURL = vi.fn();
        authFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['png'])) });
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    });

    it('shows the entry’s picture where the text places it, loaded with the session, and opens it in the preview', async () => {
        render(
            <EntryContentRenderer {...defaultProps} format="markdown" attachments={attachments} content={'Morning\n\n![The pier at dawn](attachment:5)\n\nAfter'} />,
        );

        const open = await screen.findByRole('button', { name: 'Open the picture The pier at dawn' });
        expect(authFetch).toHaveBeenCalledWith('/api/attachments/file/stored-5.png');
        expect(open.querySelector('img')).toHaveAttribute('alt', 'The pier at dawn');
        expect(open.querySelector('img')).toHaveAttribute('src', 'blob:pier');

        await userEvent.click(open);
        expect(await screen.findByRole('dialog', { name: /pier\.png/ })).toBeInTheDocument();
    });

    it('names a picture without alt text by its file and says when it is still loading', async () => {
        authFetch.mockReturnValue(new Promise(() => {}));
        render(<EntryContentRenderer {...defaultProps} format="markdown" attachments={attachments} content="![](attachment:5)" />);

        expect(await screen.findByRole('button', { name: 'Loading the picture pier.png' })).toBeDisabled();
    });

    it('shows a placeholder for a picture that is no longer there, and the name of a file that is not a picture', async () => {
        render(
            <EntryContentRenderer
                {...defaultProps}
                format="markdown"
                attachments={attachments}
                content={'![Old view](attachment:9) and ![](attachment:6) and ![](attachment:10)'}
            />,
        );

        expect(await screen.findByText('Picture no longer available: Old view')).toBeInTheDocument();
        expect(screen.getByText('notes.pdf')).toBeInTheDocument();
        expect(screen.getByText('Picture no longer available')).toBeInTheDocument();
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('shows only the alt text where attachments are not available, and for web images the page blocks', async () => {
        const { container } = render(
            <EntryContentRenderer
                {...defaultProps}
                format="markdown"
                content={'![The pier](attachment:5) ![A web photo](https://example.com/a.png) ![](https://example.com/b.png)'}
            />,
        );

        await waitFor(() => expect(screen.getByText('The pier')).toBeInTheDocument());
        expect(screen.getByText('A web photo')).toHaveClass('inline-image-alt');
        expect(container.querySelector('img')).toBeNull();
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('waits until the picture comes near the screen before loading it', async () => {
        let reveal: (visible: boolean) => void = () => {};
        const disconnect = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: (records: Array<{ isIntersecting: boolean }>) => void) {
                reveal = (visible) => callback([{ isIntersecting: visible }]);
            }
            observe() {}
            disconnect = disconnect;
        });
        try {
            render(<EntryContentRenderer {...defaultProps} format="markdown" attachments={attachments} content="![Pier](attachment:5)" />);
            await screen.findByRole('button', { name: 'Loading the picture Pier' });
            expect(authFetch).not.toHaveBeenCalled();

            reveal(false);
            expect(authFetch).not.toHaveBeenCalled();
            reveal(true);
            expect(await screen.findByRole('button', { name: 'Open the picture Pier' })).toBeEnabled();
            expect(disconnect).toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('leaves plain-text entries as written', () => {
        render(<EntryContentRenderer {...defaultProps} attachments={attachments} content="![x](attachment:5)" />);
        expect(screen.getByText('![x](attachment:5)')).toBeInTheDocument();
    });
});
