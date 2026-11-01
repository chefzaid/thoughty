import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import NavMenu from '../NavMenu/NavMenu';
import QuickCaptureDialog from './QuickCaptureDialog';
import { useQuickCapture } from './useQuickCapture';

const pressShortcut = (init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true, ...init });
    act(() => { (document.activeElement ?? document.body).dispatchEvent(event); });
    return event;
};

type CreateEntry = Parameters<typeof useQuickCapture>[0]['entriesService']['createEntry'];

function Harness({ createEntry, language = 'en' }: { createEntry: CreateEntry; language?: 'en' | 'fr' }) {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
    const [notice, setNotice] = useState('');
    const quickCapture = useQuickCapture({
        entriesService: { createEntry },
        notifier: { notify: setNotice, t, language },
        onSaved: () => undefined,
        entryPath: (entryId) => `/journal?entry=${entryId}`,
        onOpenEntry: () => undefined,
        onOpenInFull: () => undefined,
    });
    return (
        <>
            <NavMenu currentView="stats" onViewChange={() => undefined} t={t} quickCapture={quickCapture} />
            <textarea aria-label="Elsewhere" />
            <p data-testid="notice">{notice}</p>
            <QuickCaptureDialog quickCapture={quickCapture} t={t} />
        </>
    );
}

const saved = () => vi.fn<CreateEntry>().mockResolvedValue({ success: true, entryId: 5 });
const navButton = () => screen.getByRole('button', { name: 'Quick capture' });

describe('QuickCaptureDialog', () => {
    it('opens from the navigation as a labelled dialog with its field focused, and Escape returns focus', () => {
        render(<Harness createEntry={saved()} />);
        const button = navButton();
        expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Space Meta+Shift+Space');
        expect(button).toHaveAttribute('title', 'Quick capture (Ctrl+Shift+Space)');
        expect(button).toHaveAttribute('aria-expanded', 'false');

        button.focus();
        fireEvent.click(button);
        const dialog = screen.getByRole('dialog', { name: 'Quick capture' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription('Enter saves it as a private entry for today in your default diary.');
        const field = screen.getByRole('textbox', { name: "What's on your mind?" });
        expect(field).toHaveFocus();
        expect(field).toHaveClass('privacy-text');
        expect(button).toHaveAttribute('aria-expanded', 'true');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    it('opens with the shortcut while typing elsewhere, and the shortcut brings focus back to its field', () => {
        render(<Harness createEntry={saved()} />);
        const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' });
        elsewhere.focus();

        const event = pressShortcut();
        expect(event.defaultPrevented).toBe(true);
        const field = screen.getByRole('textbox', { name: "What's on your mind?" });
        expect(field).toHaveFocus();

        screen.getByRole('button', { name: 'Cancel' }).focus();
        expect(pressShortcut().defaultPrevented).toBe(true);
        expect(field).toHaveFocus();
        expect(screen.getAllByRole('dialog')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(elsewhere).toHaveFocus();
    });

    it('does not open over another dialog, on a held key, or when the key was already used', () => {
        render(<Harness createEntry={saved()} />);
        const other = document.createElement('div');
        other.setAttribute('aria-modal', 'true');
        document.body.append(other);
        expect(pressShortcut().defaultPrevented).toBe(false);
        expect(screen.queryByRole('dialog', { name: 'Quick capture' })).not.toBeInTheDocument();
        other.remove();

        expect(pressShortcut({ repeat: true }).defaultPrevented).toBe(true);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const handled = new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
        handled.preventDefault();
        act(() => { document.body.dispatchEvent(handled); });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('saves on Enter and says so', async () => {
        const createEntry = saved();
        render(<Harness createEntry={createEntry} />);
        pressShortcut();
        const field = screen.getByRole('textbox', { name: "What's on your mind?" });
        fireEvent.change(field, { target: { value: 'Buy stamps' } });

        await act(async () => { fireEvent.submit(field.closest('form')!); });

        expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ text: 'Buy stamps', visibility: 'private', format: 'plain', diaryId: null }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('notice')).toHaveTextContent('Saved as a private entry for today.');
    });

    it('keeps the text and says why when the save fails, in French', async () => {
        let finish: (value: { success: boolean }) => void = () => undefined;
        const createEntry = vi.fn<CreateEntry>(() => new Promise((resolve) => { finish = resolve; }));
        render(<Harness createEntry={createEntry} language="fr" />);
        fireEvent.click(screen.getByRole('button', { name: 'Capture rapide' }));
        const field = screen.getByRole('textbox', { name: "Qu'avez-vous à l'esprit ?" });
        fireEvent.change(field, { target: { value: 'Appeler maman' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(screen.getByRole('button', { name: 'Enregistrement...' })).toBeDisabled();
        await act(async () => { finish({ success: false }); });

        expect(screen.getByRole('alert')).toHaveTextContent('Impossible d’enregistrer l’entrée. Veuillez réessayer.');
        expect(field).toHaveValue('Appeler maman');
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription('Impossible d’enregistrer l’entrée. Veuillez réessayer.');
        expect(field).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Ouvrir dans l’éditeur' })).toBeInTheDocument();
    });

    it('closes when the backdrop is clicked', () => {
        render(<Harness createEntry={saved()} />);
        fireEvent.click(navButton());
        const backdrop = document.querySelector<HTMLButtonElement>('button[aria-hidden="true"]');
        fireEvent.click(backdrop!);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
