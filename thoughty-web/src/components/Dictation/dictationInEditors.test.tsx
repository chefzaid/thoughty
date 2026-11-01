import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import EntryForm from '../EntryForm/EntryForm';
import FocusMode from '../FocusMode/FocusMode';
import { EditForm } from '../EntriesList/EntriesList.helpers';
import { getTranslation } from '../../utils/translations';
import { FakeSpeechRecognition, installFakeSpeechRecognition } from '../../test/fakeSpeechRecognition';
import { saveNoticeSeen } from './speechRecognition';

const english = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

function Composer({ format = 'plain' }: { format?: 'plain' | 'markdown' }) {
    const [text, setText] = useState('Today ');
    return (
        <EntryForm
            newEntryText={text}
            setNewEntryText={setText}
            selectedDate={new Date('2024-01-15')}
            setSelectedDate={vi.fn()}
            tags={[]}
            setTags={vi.fn()}
            visibility="private"
            setVisibility={vi.fn()}
            format={format}
            setFormat={vi.fn()}
            allTags={[]}
            formError=""
            onSubmit={vi.fn()}
            theme="light"
            language="en"
            t={english}
        />
    );
}

describe('dictation in the writing fields', () => {
    let uninstall: () => void;

    beforeEach(() => {
        localStorage.clear();
        saveNoticeSeen();
        uninstall = installFakeSpeechRecognition();
    });

    afterEach(() => {
        uninstall();
        document.body.style.overflow = '';
    });

    it('writes into the plain composer, with the interim words under it', async () => {
        const user = userEvent.setup();
        render(<Composer />);
        await user.click(screen.getByRole('button', { name: 'Dictate' }));
        const recognition = FakeSpeechRecognition.latest;
        recognition.emitStart();
        recognition.emitInterim('the sun');
        expect(screen.getByText('the sun')).toHaveClass('privacy-text');
        recognition.emitFinal('the sun came out');
        expect(screen.getByPlaceholderText(/What's on your mind/)).toHaveValue('Today the sun came out');
    });

    it('writes into the Markdown editor', async () => {
        const user = userEvent.setup();
        render(<Composer format="markdown" />);
        const editor = await screen.findByTestId('md-editor');
        await user.click(screen.getByRole('button', { name: 'Dictate' }));
        FakeSpeechRecognition.latest.emitFinal('**bold** morning');
        expect(within(editor).getByRole('textbox')).toHaveValue('Today **bold** morning');
    });

    it('writes into the entry editor', async () => {
        const user = userEvent.setup();
        function Editor() {
            const [text, setText] = useState('Edited');
            return (
                <EditForm
                    config={{ theme: 'dark', language: 'en' } as never}
                    editText={text}
                    setEditText={setText}
                    editDate={new Date('2024-01-15')}
                    setEditDate={vi.fn()}
                    allTags={[]}
                    tagMetadata={{}}
                    editTags={[]}
                    setEditTags={vi.fn()}
                    editVisibility="private"
                    setEditVisibility={vi.fn()}
                    editFormat="plain"
                    setEditFormat={vi.fn()}
                    onSaveEdit={vi.fn()}
                    onCancelEdit={vi.fn()}
                    t={english}
                />
            );
        }
        render(<Editor />);
        await user.click(screen.getByRole('button', { name: 'Dictate' }));
        FakeSpeechRecognition.latest.emitFinal('later that day');
        expect(screen.getByRole('textbox', { name: 'Text of the entry' })).toHaveValue('Edited later that day');
        expect(screen.getByText('Listening…')).toBeInTheDocument();
    });

    it('writes into focus mode, where Escape stops dictation and leaves focus mode open', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        function Focus() {
            const [text, setText] = useState('');
            return <FocusMode text={text} onTextChange={setText} onClose={onClose} t={english} />;
        }
        render(<Focus />);
        const dialog = screen.getByRole('dialog', { name: 'Focus mode' });
        const toggle = within(dialog).getByRole('button', { name: 'Dictate' });
        expect(toggle).toHaveClass('focus-mode-dictate');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        const text = within(dialog).getByRole('textbox', { name: 'Entry text' });
        expect(text).toHaveFocus();
        FakeSpeechRecognition.latest.emitFinal('a quiet hour');
        expect(text).toHaveValue('a quiet hour');

        await user.keyboard('{Escape}');
        expect(FakeSpeechRecognition.latest.stopped).toBe(true);
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(onClose).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stops the composer dictation when focus mode opens over it', async () => {
        const user = userEvent.setup();
        render(<Composer />);
        await user.click(screen.getByRole('button', { name: 'Dictate' }));
        const composerSession = FakeSpeechRecognition.latest;
        await user.click(screen.getByRole('button', { name: 'Write in focus mode (Ctrl+Shift+F)' }));
        expect(composerSession.stopped).toBe(true);
    });
});
