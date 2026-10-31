import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { getTranslation } from '../../utils/translations';
import FocusMode from './FocusMode';

const english = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const french = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

function ControlledFocusMode({ initialText = '', ...props }: Partial<ComponentProps<typeof FocusMode>> & { initialText?: string }) {
    const [text, setText] = useState(initialText);
    return <FocusMode text={text} onTextChange={setText} onClose={vi.fn()} t={english} {...props} />;
}

const minutes = (count: number) => count * 60_000;
const advance = (ms: number) => act(() => {
    vi.advanceTimersByTime(ms);
});
const sprintPicker = () => screen.getByLabelText('Timed sprint');
const countdown = () => screen.queryByRole('timer');
const sprintStatus = () => screen.getAllByRole('status').find((status) => status.classList.contains('focus-mode-sprint-status'));
const type = (text: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

describe('FocusMode timed sprints', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.style.overflow = '';
    });

    it('has no sprint until one is chosen, then counts down quietly next to the word count', () => {
        render(<ControlledFocusMode />);

        expect(sprintPicker()).toHaveValue('');
        expect(countdown()).not.toBeInTheDocument();
        fireEvent.change(sprintPicker(), { target: { value: '5' } });

        const timer = screen.getByRole('timer');
        expect(timer).toHaveAttribute('aria-live', 'off');
        expect(timer).toHaveTextContent('Time left in the sprint: 05:00');
        expect(localStorage.getItem('thoughty.focusModeSprint')).toBe('5');
        advance(1_000);
        expect(timer).toHaveTextContent('04:59');
        advance(minutes(1));
        expect(timer).toHaveTextContent('03:59');
        expect(sprintStatus()).toBeEmptyDOMElement();
    });

    it('announces the halfway point and the end once each, then offers to keep going or stop', () => {
        const onClose = vi.fn();
        render(<ControlledFocusMode initialText="Already here" onClose={onClose} />);
        fireEvent.change(sprintPicker(), { target: { value: '10' } });

        advance(minutes(5) - 1);
        expect(sprintStatus()).toBeEmptyDOMElement();
        advance(1);
        expect(sprintStatus()).toHaveTextContent('Halfway through the sprint');
        expect(screen.queryByRole('heading', { name: /Time's up/ })).not.toBeInTheDocument();

        type('Already here and three more');
        advance(minutes(5));
        expect(screen.getByRole('timer')).toHaveTextContent('00:00');
        expect(screen.getByRole('heading', { name: "Time's up — keep going or stop here" })).toBeInTheDocument();
        expect(screen.getByText('3 words written in this sprint')).toBeInTheDocument();
        expect(sprintStatus()).toHaveTextContent("Time's up — keep going or stop here. 3 words written in this sprint");
        // Writing on after the end keeps the sprint's own count
        type('Already here and three more, and on');
        expect(screen.getByText('3 words written in this sprint')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Stop here' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps going without a sprint, and offers the same length next time', () => {
        localStorage.setItem('thoughty.focusModeSprint', '15');
        const { unmount } = render(<ControlledFocusMode />);

        // The remembered length starts a sprint as focus mode opens
        expect(sprintPicker()).toHaveValue('15');
        expect(screen.getByRole('timer')).toHaveTextContent('15:00');
        advance(minutes(15));
        expect(screen.getByText('0 words written in this sprint')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
        expect(screen.queryByRole('heading', { name: /Time's up/ })).not.toBeInTheDocument();
        expect(countdown()).not.toBeInTheDocument();
        expect(sprintPicker()).toHaveValue('');
        expect(sprintStatus()).toBeEmptyDOMElement();
        expect(screen.getByRole('textbox', { name: 'Entry text' })).toHaveFocus();
        unmount();

        render(<ControlledFocusMode />);
        expect(sprintPicker()).toHaveValue('15');
    });

    it('starts over when another length is chosen, and stops when turned off', () => {
        render(<ControlledFocusMode />);
        fireEvent.change(sprintPicker(), { target: { value: '5' } });
        advance(minutes(4));
        expect(screen.getByRole('timer')).toHaveTextContent('01:00');
        expect(sprintStatus()).toHaveTextContent('Halfway through the sprint');

        fireEvent.change(sprintPicker(), { target: { value: '10' } });
        expect(screen.getByRole('timer')).toHaveTextContent('10:00');
        expect(sprintStatus()).toBeEmptyDOMElement();
        advance(minutes(2));
        expect(screen.queryByRole('heading', { name: /Time's up/ })).not.toBeInTheDocument();

        fireEvent.change(sprintPicker(), { target: { value: '' } });
        expect(countdown()).not.toBeInTheDocument();
        expect(localStorage.getItem('thoughty.focusModeSprint')).toBeNull();
        advance(minutes(10));
        expect(screen.queryByRole('heading', { name: /Time's up/ })).not.toBeInTheDocument();
    });

    it('runs on the wall clock, so a tab shown again after the end has ended on time', () => {
        render(<ControlledFocusMode />);
        fireEvent.change(sprintPicker(), { target: { value: '5' } });

        // A hidden tab's timers can run late; the clock moves on regardless
        vi.setSystemTime(Date.now() + minutes(6));
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(screen.getByRole('timer')).toHaveTextContent('00:00');
        expect(screen.getByRole('heading', { name: "Time's up — keep going or stop here" })).toBeInTheDocument();
    });

    it('draws a ring that empties with the time left', () => {
        render(<ControlledFocusMode />);
        fireEvent.change(sprintPicker(), { target: { value: '10' } });
        const fill = document.querySelector('.focus-mode-sprint-ring-fill');
        const length = Number(fill?.getAttribute('stroke-dasharray'));

        expect(Number(fill?.getAttribute('stroke-dashoffset'))).toBe(0);
        advance(minutes(5));
        expect(Number(fill?.getAttribute('stroke-dashoffset'))).toBeCloseTo(length / 2);
        expect(fill?.closest('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('speaks French', () => {
        render(<ControlledFocusMode t={french} language="fr" initialText="Bonjour" />);
        const picker = screen.getByLabelText('Sprint chronométré');
        expect([...picker.querySelectorAll('option')].map((option) => option.textContent))
            .toEqual(['Désactivé', '5 minutes', '10 minutes', '15 minutes']);

        fireEvent.change(picker, { target: { value: '5' } });
        type('Bonjour toi');
        advance(minutes(5));
        expect(screen.getByRole('heading', { name: 'C’est l’heure — continuez ou arrêtez-vous ici' })).toBeInTheDocument();
        expect(screen.getByText('1 mot écrit pendant ce sprint')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'M’arrêter ici' })).toBeInTheDocument();
    });
});
