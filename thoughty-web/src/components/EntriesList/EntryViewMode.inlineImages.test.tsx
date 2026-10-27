import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import type { Attachment } from '../../types';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

vi.mock('../../hooks/useApiServices', () => ({
    useApiServices: () => ({ attachmentsService: {} }),
}));

vi.mock('../AttachmentPreview/useAuthenticatedAttachmentUrl', () => ({
    useAuthenticatedAttachmentUrl: (storedFilename: string | null) => (storedFilename ? `blob:${storedFilename}` : null),
}));

const picture = (id: number, name: string): Attachment => ({
    id,
    entry_id: mockEntries[0]!.id,
    original_filename: name,
    stored_filename: `stored-${id}`,
    mimetype: 'image/png',
    size: 100,
} as Attachment);

describe('EntryViewMode inline images', () => {
    it('shows a placed picture in the text and only the other attachments below it', async () => {
        const entry = {
            ...mockEntries[0]!,
            format: 'markdown' as const,
            content: 'Morning\n\n![The pier](attachment:5)',
            attachments: [picture(5, 'pier.png'), picture(6, 'beach.png')],
        };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, t })} />);

        expect(await screen.findByRole('button', { name: 'Open the picture The pier' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'beach.png' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'pier.png' })).toBeNull();
    });

    it('keeps every attachment below a plain-text entry', () => {
        const entry = { ...mockEntries[0]!, content: '![The pier](attachment:5)', attachments: [picture(5, 'pier.png')] };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, t })} />);

        expect(screen.getByRole('img', { name: 'pier.png' })).toBeInTheDocument();
    });
});
