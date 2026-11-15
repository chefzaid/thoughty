import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePointerMoved } from './heatmapPointer';

/** A pointer move the window hears, as one bubbling up from the page would reach it (jsdom has no PointerEvent). */
const windowHears = (clientX: number, clientY: number) => window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));

describe('usePointerMoved', () => {
    it('counts the first move, and then only a move to somewhere else than the latest one', () => {
        const { result } = renderHook(() => usePointerMoved());

        expect(result.current({ clientX: 120, clientY: 80 })).toBe(true);
        windowHears(120, 80);
        // The page scrolled under the still mouse: same spot
        expect(result.current({ clientX: 120, clientY: 80 })).toBe(false);
        expect(result.current({ clientX: 121, clientY: 80 })).toBe(true);
        expect(result.current({ clientX: 120, clientY: 81 })).toBe(true);
        windowHears(121, 80);
        expect(result.current({ clientX: 120, clientY: 80 })).toBe(true);
    });

    it('stops listening to the window when its component goes', () => {
        const { result, unmount } = renderHook(() => usePointerMoved());
        const moved = result.current;
        windowHears(10, 10);
        unmount();

        windowHears(50, 50);
        expect(moved({ clientX: 10, clientY: 10 })).toBe(false);
        expect(moved({ clientX: 50, clientY: 50 })).toBe(true);
    });
});
