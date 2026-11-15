import { useCallback, useEffect, useRef } from 'react';

/** Where a pointer event happened, in the window. */
interface PointerPosition {
    readonly clientX: number;
    readonly clientY: number;
}

/**
 * Tells a move of the pointer itself from one a browser reports when the page scrolls under a still
 * mouse: Chromium then only sends boundary events (`pointerover`, `pointerout`), but a browser may also
 * send a `pointermove` at the spot the pointer rests on. The window keeps the position of the latest
 * pointer move; the check, called from a component's own `pointermove` handler (which hears the event
 * before the window does), says whether this one reached anywhere else. Before the first move there is
 * nothing to compare with, so it counts.
 */
export function usePointerMoved(): (event: PointerPosition) => boolean {
    const last = useRef<PointerPosition | null>(null);

    useEffect(() => {
        const remember = ({ clientX, clientY }: PointerEvent) => {
            last.current = { clientX, clientY };
        };
        window.addEventListener('pointermove', remember, { passive: true });
        return () => window.removeEventListener('pointermove', remember);
    }, []);

    return useCallback(
        ({ clientX, clientY }: PointerPosition) => last.current?.clientX !== clientX || last.current?.clientY !== clientY,
        [],
    );
}
