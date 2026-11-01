import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { getTranslation } from '../../utils/translations';
import { FakeSpeechRecognition, installFakeSpeechRecognition } from '../../test/fakeSpeechRecognition';
import { useDictationField } from './useDictationField';
import { stopActiveDictation } from './useDictation';

const english = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const french = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

function Field({ initialText = '', language = 'en', label = 'Entry text' }: { initialText?: string; language?: string; label?: string }) {
    const [text, setText] = useState(initialText);
    const fieldRef = useRef<HTMLDivElement>(null);
    const dictation = useDictationField({ fieldRef, text, setText, language, theme: 'light', t: language === 'fr' ? french : english });
    return (
        <div>
            <div ref={fieldRef}>
                <textarea aria-label={label} className="privacy-text" value={text} onChange={(event) => setText(event.target.value)} />
            </div>
            {dictation.preview}
            {dictation.button}
            <button type="button">Elsewhere</button>
        </div>
    );
}

const field = (name = 'Entry text') => screen.getByRole('textbox', { name }) as HTMLTextAreaElement;
const toggle = (name = 'Dictate') => screen.getByRole('button', { name });

async function startDictation(user: ReturnType<typeof userEvent.setup>, name = 'Dictate') {
    await user.click(toggle(name));
    const start = screen.queryByRole('button', { name: 'Start dictating' });
    if (start) await user.click(start);
    FakeSpeechRecognition.latest.emitStart();
}

describe('useDictationField', () => {
    let uninstall: () => void;

    beforeEach(() => {
        localStorage.clear();
        uninstall = installFakeSpeechRecognition();
    });

    afterEach(() => {
        uninstall();
    });

    it('shows no button where the browser has no speech recognition', () => {
        uninstall();
        render(<Field />);
        expect(screen.queryByRole('button', { name: 'Dictate' })).not.toBeInTheDocument();
    });

    it('explains where speech goes before the first use, and starts only when asked', async () => {
        const user = userEvent.setup();
        render(<Field />);

        await user.click(toggle());
        expect(screen.getByRole('group', { name: /send the audio to their maker's speech service/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start dictating' })).toHaveFocus();
        expect(FakeSpeechRecognition.instances).toHaveLength(0);

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');

        await user.click(toggle());
        await user.click(screen.getByRole('button', { name: 'Start dictating' }));
        expect(FakeSpeechRecognition.latest.started).toBe(true);
        expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    });

    it('does not show the note again once seen, and Escape closes it unseen', async () => {
        const user = userEvent.setup();
        render(<Field />);

        await user.click(toggle());
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();

        await startDictation(user);
        await user.click(toggle());
        await user.click(toggle());
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(FakeSpeechRecognition.instances).toHaveLength(2);
    });

    it('closes the note when focus leaves it', async () => {
        const user = userEvent.setup();
        render(<Field />);
        await user.click(toggle());
        await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
        expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('listens in the app language, continuously, with interim results', async () => {
        const user = userEvent.setup();
        render(<Field language="fr" label="Texte" />);

        await user.click(toggle('Dicter'));
        expect(screen.getByRole('group', { name: /service de reconnaissance vocale/ })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Commencer la dictée' }));
        const recognition = FakeSpeechRecognition.latest;
        expect(recognition).toMatchObject({ lang: 'fr-FR', continuous: true, interimResults: true, maxAlternatives: 1 });

        recognition.emitStart();
        expect(screen.getByRole('status')).toHaveTextContent('Dictée activée');
        recognition.emitFinal('bonjour à tous');
        expect(field('Texte').value).toBe('bonjour à tous');
    });

    it('writes final phrases at the caret, shows interim words apart and blurred, and keeps the caret after them', async () => {
        const user = userEvent.setup();
        render(<Field initialText="We walked. It rained." />);
        const area = field();
        await user.click(area);
        area.setSelectionRange(9, 9);
        fireEvent.keyUp(area);

        await startDictation(user);
        expect(area).toHaveFocus();
        expect(area.selectionStart).toBe(9);
        expect(screen.getByRole('status')).toHaveTextContent('Dictation on. Speak to write; Escape stops.');
        expect(screen.getByText('Listening…')).toBeInTheDocument();

        const recognition = FakeSpeechRecognition.latest;
        recognition.emitInterim('along the');
        const interim = screen.getByText('along the');
        expect(interim).toHaveClass('privacy-text');
        expect(interim.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(area.value).toBe('We walked. It rained.');

        recognition.emitFinal('along the river');
        expect(area.value).toBe('We walked along the river. It rained.');
        expect(screen.queryByText('along the')).not.toBeInTheDocument();
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(area.selectionStart).toBe('We walked along the river'.length);

        recognition.emitFinal('at dawn');
        recognition.emitFinal('slowly');
        expect(area.value).toBe('We walked along the river at dawn slowly. It rained.');
    });

    it('replaces selected text with the spoken words', async () => {
        const user = userEvent.setup();
        render(<Field initialText="I felt sad today" />);
        const area = field();
        await user.click(area);
        area.setSelectionRange(7, 10);
        fireEvent.keyUp(area);

        await startDictation(user);
        FakeSpeechRecognition.latest.emitFinal('calm');
        expect(area.value).toBe('I felt calm today');
    });

    it('writes at the end when the writer never placed the caret', async () => {
        const user = userEvent.setup();
        render(<Field initialText="Draft" />);
        await startDictation(user);
        FakeSpeechRecognition.latest.emitFinal('continues here');
        expect(field().value).toBe('Draft continues here');
    });

    it('stops on a second press and on Escape, and announces it', async () => {
        const user = userEvent.setup();
        render(<Field />);

        await startDictation(user);
        const first = FakeSpeechRecognition.latest;
        await user.click(toggle());
        expect(first.stopped).toBe(true);
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        // The browser still hands over the last words before it ends
        first.emitFinal('last words');
        expect(field().value).toBe('last words');
        first.emitEnd();
        expect(screen.getByRole('status')).toHaveTextContent('Dictation off.');

        await startDictation(user);
        const second = FakeSpeechRecognition.latest;
        await user.keyboard('{Escape}');
        expect(second.stopped).toBe(true);
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByText('Listening…')).not.toBeInTheDocument();
    });

    it('ends when the browser ends the session, and never restarts by itself', async () => {
        const user = userEvent.setup();
        render(<Field />);
        await startDictation(user);
        FakeSpeechRecognition.latest.emitEnd();
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        expect(FakeSpeechRecognition.instances).toHaveLength(1);
    });

    it('says clearly when the microphone is refused', async () => {
        const user = userEvent.setup();
        render(<Field />);
        await startDictation(user);
        const recognition = FakeSpeechRecognition.latest;
        recognition.emitError('not-allowed');
        recognition.emitEnd();
        expect(screen.getByRole('alert')).toHaveTextContent('Microphone access was refused.');
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');

        // Trying again clears the message
        await startDictation(user);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says nothing when the session was aborted on purpose', async () => {
        const user = userEvent.setup();
        render(<Field />);
        await startDictation(user);
        FakeSpeechRecognition.latest.emitError('aborted');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reports a browser that refuses to start', async () => {
        const user = userEvent.setup();
        render(<Field />);
        FakeSpeechRecognition.failNextStart = true;
        await user.click(toggle());
        await user.click(screen.getByRole('button', { name: 'Start dictating' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Dictation stopped because of an error.');
        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    });

    it('lets only one field listen at a time, and a view opening over it stop it', async () => {
        const user = userEvent.setup();
        render(
            <>
                <Field label="First" />
                <Field label="Second" />
            </>,
        );
        const [firstToggle, secondToggle] = screen.getAllByRole('button', { name: 'Dictate' });
        await user.click(firstToggle!);
        await user.click(screen.getByRole('button', { name: 'Start dictating' }));
        const first = FakeSpeechRecognition.latest;
        await user.click(secondToggle!);
        expect(first.stopped).toBe(true);
        expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
        expect(secondToggle).toHaveAttribute('aria-pressed', 'true');

        act(() => stopActiveDictation());
        expect(FakeSpeechRecognition.latest.stopped).toBe(true);
        expect(secondToggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('aborts listening when the field goes away', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<Field />);
        await startDictation(user);
        const recognition = FakeSpeechRecognition.latest;
        unmount();
        expect(recognition.aborted).toBe(true);
        expect(recognition.onresult).toBeNull();
    });
});
