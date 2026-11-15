import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useScrolledFrames } from './useScrolledFrames';

describe('useScrolledFrames', () => {
    let frames: Map<number, FrameRequestCallback>;
    let nextId: number;
    const element = document.createElement('div');
    const ref = { current: element };

    /** Runs the frame the browser would paint next. */
    const runFrame = () => act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(performance.now()));
    });

    beforeEach(() => {
        frames = new Map();
        nextId = 0;
        element.scrollTop = 0;
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
            nextId += 1;
            frames.set(nextId, callback);
            return nextId;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
            frames.delete(id);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls back in the first frame and then in each frame the scroll position moved, without a scroll event', () => {
        const onScrolled = vi.fn();
        renderHook(() => useScrolledFrames(ref, true, onScrolled));

        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(1);
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(1);

        element.scrollTop = 30;
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(2);
        element.scrollTop = 45;
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(3);
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(3);
    });

    it('renders the update within the frame, before the browser paints it', () => {
        const { result } = renderHook(() => {
            const [top, setTop] = useState(-1);
            useScrolledFrames(ref, true, () => setTop(element.scrollTop));
            return top;
        });
        element.scrollTop = 12;
        // As the browser runs it, outside act(): an update React scheduled for later would not show yet
        const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
        const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
        try {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach((callback) => callback(performance.now()));
            expect(result.current).toBe(12);
        } finally {
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
        }
    });

    it('asks for no frame while inactive and stops asking once inactive or unmounted', () => {
        const onScrolled = vi.fn();
        const { rerender, unmount } = renderHook(({ active }) => useScrolledFrames(ref, active, onScrolled), {
            initialProps: { active: false },
        });
        expect(frames.size).toBe(0);

        rerender({ active: true });
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(1);
        rerender({ active: false });
        expect(frames.size).toBe(0);
        element.scrollTop = 60;
        runFrame();
        expect(onScrolled).toHaveBeenCalledTimes(1);

        rerender({ active: true });
        expect(frames.size).toBe(1);
        unmount();
        expect(frames.size).toBe(0);
    });
});
