import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps } from './EntriesList.test-utils';
import AudioTranscript from '../AttachmentDisplay/AudioTranscript';
import type { Attachment } from '../../types';
import { getTranslation } from '../../utils/translations';
import { makeDiary } from '../../test/diaryFixture';
import { withFeatureFlags } from '../../test/featureFlags';

// With public sharing off, Discuss is the AI chat alone, so its button says whether the diary offers it
const wrapper = withFeatureFlags({ publicSharing: false });

vi.mock('../../hooks/useApiServices', () => ({ useApiServices: () => ({ attachmentsService: { transcribeAttachment: vi.fn() } }) }));
vi.mock('../AttachmentPreview/useAuthenticatedAttachmentUrl', () => ({
    useAuthenticatedAttachmentUrl: (storedFilename: string) => `blob:${storedFilename}`,
    useAuthenticatedAttachmentResource: (storedFilename: string) => ({ url: `blob:${storedFilename}`, status: 'ready' }),
}));

const t = (key: string) => getTranslation('en', key);

describe('an entry in a diary with AI off', () => {
    const recording: Attachment = { id: 3, original_filename: 'voice.mp3', stored_filename: 'voice.mp3', mimetype: 'audio/mpeg', size: 10 };

    it.each([
        ['off', false],
        ['on', true],
    ] as const)('offers the AI actions only when its diary has AI %s', (aiMode, offered) => {
        const diaries = [makeDiary({ id: 1, name: 'Work', aiMode }), makeDiary({ id: 2, name: 'Personal' })];
        render(<EntryViewMode {...createEntryViewModeProps({ diaries, onDiscuss: vi.fn() })} />, { wrapper });

        expect(Boolean(screen.queryByTitle('Discuss entry'))).toBe(offered);
    });

    it('still offers to discuss the entry with someone in a diary with AI off, while public sharing is on', () => {
        const diaries = [makeDiary({ id: 1, name: 'Work', aiMode: 'off' })];
        render(<EntryViewMode {...createEntryViewModeProps({ diaries, onDiscuss: vi.fn() })} />);

        expect(screen.getByRole('button', { name: 'Discuss with someone' })).not.toHaveAttribute('aria-haspopup');
        expect(screen.queryByTitle('Discuss entry')).not.toBeInTheDocument();
    });

    it('offers Rephrase, Summarize, chat and transcription in a diary that asks each time, each asking first', () => {
        const diaries = [makeDiary({ id: 1, name: 'Dreams', aiMode: 'ask' })];
        const entry = { ...createEntryViewModeProps().entry, attachments: [recording] };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries, onDiscuss: vi.fn(), onRephrase: vi.fn(), onSummarize: vi.fn() })} />, { wrapper });

        expect(screen.getByTitle('Discuss entry')).toBeInTheDocument();
        expect(screen.getByTitle('Rephrase entry')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'transcribeAudio' })).toBeInTheDocument();
    });

    it('offers Rephrase, Summarize, the chat and transcription in a diary on the writer’s own model', () => {
        const diaries = [makeDiary({ id: 1, name: 'Letters', aiMode: 'local' })];
        const entry = { ...createEntryViewModeProps().entry, attachments: [recording] };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries, onDiscuss: vi.fn(), onRephrase: vi.fn(), onSummarize: vi.fn() })} />, { wrapper });

        expect(screen.getByTitle('Discuss entry')).toBeInTheDocument();
        expect(screen.getByTitle('Rephrase entry')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'transcribeAudio' })).toBeInTheDocument();
    });

    it('offers no transcription for a recording, and still shows a transcript already made', () => {
        const { container } = render(<AudioTranscript attachment={recording} attachmentsService={{} as never} isDark t={t} aiMode="off" />);
        expect(container).toBeEmptyDOMElement();

        render(<AudioTranscript attachment={{ ...recording, transcript: 'Said before' }} attachmentsService={{} as never} isDark t={t} aiMode="off" />);
        expect(screen.getByText('Said before')).toBeInTheDocument();
    });
});
