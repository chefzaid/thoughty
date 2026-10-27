import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Attachment } from '../../types';
import { getTranslation } from '../../utils/translations';
import { useInlineImageInsert, type InlineImageTarget } from './useInlineImageInsert';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const stored = { id: 5, original_filename: 'pier.png', mimetype: 'image/png', stored_filename: 's.png', size: 1 } as Attachment;
const notes = { id: 6, original_filename: 'notes.pdf', mimetype: 'application/pdf', stored_filename: 'n.pdf', size: 1 } as Attachment;
const picked = new File(['x'], 'sea view.jpg', { type: 'image/jpeg' });
const memo = new File(['x'], 'memo.mp3', { type: 'audio/mpeg' });

function Harness({ initial, attachments = [stored, notes], pendingFiles = [memo, picked], target, withField = true }: Readonly<{
    initial: string;
    attachments?: Attachment[];
    pendingFiles?: File[];
    target?: InlineImageTarget;
    withField?: boolean;
}>) {
    const [text, setText] = useState(initial);
    const inline = useInlineImageInsert({ text, setText, pendingFiles, attachments, theme: 'light', t });
    return (
        <div>
            <div ref={inline.fieldRef}>
                {withField
                    ? <textarea aria-label="Entry" value={text} onChange={(event) => setText(event.target.value)} />
                    : <output aria-label="Entry">{text}</output>}
            </div>
            <button type="button" onClick={() => inline.open(target)}>Open</button>
            {inline.dialog}
        </div>
    );
}

describe('useInlineImageInsert', () => {
    it('places the chosen picture with its alt text at the caret and puts the caret after it', async () => {
        const user = userEvent.setup();
        render(<Harness initial="Hello world" />);
        const field = screen.getByRole('textbox', { name: 'Entry' }) as HTMLTextAreaElement;
        await user.click(field);
        await user.keyboard('{End}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
        // The writer's own caret counts; a selection reset they did not make does not
        await user.tab();
        field.setSelectionRange(0, 0);
        field.dispatchEvent(new Event('select', { bubbles: false }));

        await user.click(screen.getByRole('button', { name: 'Open' }));
        const dialog = screen.getByRole('dialog', { name: 'Insert a picture' });
        const picture = screen.getByRole('combobox', { name: 'Picture' });
        expect(picture).toHaveFocus();
        // Only pictures are offered: stored ones by ID, picked ones by name
        expect([...(picture as HTMLSelectElement).options].map((option) => option.text)).toEqual(['pier.png', 'sea view.jpg']);
        expect(dialog).toHaveAccessibleDescription('The picture goes where the cursor is in your text.');

        const alt = screen.getByRole('textbox', { name: 'Description (alt text)' });
        expect(alt).toHaveAccessibleDescription(/for people who cannot see it/);
        await user.type(alt, 'The pier');
        await user.click(screen.getByRole('button', { name: 'Insert' }));

        expect(field.value).toBe('Hello ![The pier](attachment:5)world');
        await waitFor(() => expect(field).toHaveFocus());
        expect(field.selectionStart).toBe('Hello ![The pier](attachment:5)'.length);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('starts on the alt text of the picture a card asked for, and names a picked file until it is saved', async () => {
        const user = userEvent.setup();
        render(<Harness initial="" target={{ pending: 1 }} />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        expect(screen.getByRole('textbox', { name: 'Description (alt text)' })).toHaveFocus();
        expect(screen.getByRole('combobox', { name: 'Picture' })).toHaveValue('pending-1');
        await user.keyboard('{Enter}');

        expect(screen.getByRole('textbox', { name: 'Entry' })).toHaveValue('![](attachment:sea%20view.jpg)');
    });

    it('opens on a stored attachment and closes without a change on Escape', async () => {
        const user = userEvent.setup();
        render(<Harness initial="Text" target={{ attachment: 5 }} />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        expect(screen.getByRole('combobox', { name: 'Picture' })).toHaveValue('attachment-5');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('textbox', { name: 'Entry' })).toHaveValue('Text');
    });

    it('explains how to attach a picture when the entry has none', async () => {
        const user = userEvent.setup();
        render(<Harness initial="Text" attachments={[notes]} pendingFiles={[memo]} />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/Attach a picture to this entry first/);
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        expect(screen.queryByRole('button', { name: 'Insert' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('adds the picture at the end when the editor has no text field yet', async () => {
        const user = userEvent.setup();
        render(<Harness initial="Text " withField={false} target={{ attachment: 5 }} />);

        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.click(screen.getByRole('button', { name: 'Insert' }));
        expect(screen.getByRole('status', { name: 'Entry' })).toHaveTextContent('Text ![](attachment:5)');
    });
});
