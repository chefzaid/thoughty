import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps } from './EntriesList.test-utils';
import AudioTranscript from '../AttachmentDisplay/AudioTranscript';
import type { Attachment } from '../../types';
import { getTranslation } from '../../utils/translations';
import { makeDiary } from '../../test/diaryFixture';

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
        render(<EntryViewMode {...createEntryViewModeProps({ diaries, onDiscuss: vi.fn() })} />);

        expect(Boolean(screen.queryByTitle('Discuss entry'))).toBe(offered);
    });

    it('offers Rephrase, Summarize, chat and transcription in a diary that asks each time, each asking first', () => {
        const diaries = [makeDiary({ id: 1, name: 'Dreams', aiMode: 'ask' })];
        const entry = { ...createEntryViewModeProps().entry, attachments: [recording] };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries, onDiscuss: vi.fn(), onRephrase: vi.fn(), onSummarize: vi.fn() })} />);

        expect(screen.getByTitle('Discuss entry')).toBeInTheDocument();
        expect(screen.getByTitle('Rephrase entry')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'transcribeAudio' })).toBeInTheDocument();
    });

    it('offers Rephrase, Summarize and the chat in a diary on the writer’s own model, but no transcription yet', () => {
        const diaries = [makeDiary({ id: 1, name: 'Letters', aiMode: 'local' })];
        const entry = { ...createEntryViewModeProps().entry, attachments: [recording] };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, diaries, onDiscuss: vi.fn(), onRephrase: vi.fn(), onSummarize: vi.fn() })} />);

        expect(screen.getByTitle('Discuss entry')).toBeInTheDocument();
        expect(screen.getByTitle('Rephrase entry')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'transcribeAudio' })).not.toBeInTheDocument();
    });

    it('offers no transcription for a recording, and still shows a transcript already made', () => {
        const { container } = render(<AudioTranscript attachment={recording} attachmentsService={{} as never} isDark t={t} aiMode="off" />);
        expect(container).toBeEmptyDOMElement();

        render(<AudioTranscript attachment={{ ...recording, transcript: 'Said before' }} attachmentsService={{} as never} isDark t={t} aiMode="off" />);
        expect(screen.getByText('Said before')).toBeInTheDocument();
    });
});
