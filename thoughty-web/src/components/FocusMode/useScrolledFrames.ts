import { useEffect, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * While `active`, calls `onScrolled` in every frame in which the element's scroll position has
 * moved, before the browser paints that frame, so something placed over the scrolled content
 * moves with it.
 *
 * A `scroll` listener cannot do it: a smooth scroll advances after the frame's scroll events,
 * so they report the position the previous frame painted, and React renders a scroll event's
 * update in a later task anyway. An animation frame callback runs after the scroll has advanced,
 * and `flushSync` writes the update to the page before the frame is painted.
 */
export function useScrolledFrames(ref: RefObject<HTMLElement | null>, active: boolean, onScrolled: () => void): void {
    useEffect(() => {
        if (!active) return undefined;
        let lastTop: number | undefined;
        let frame = 0;
        const follow = () => {
            const top = ref.current?.scrollTop;
            if (top !== lastTop) {
                lastTop = top;
                flushSync(onScrolled);
            }
            frame = requestAnimationFrame(follow);
        };
        frame = requestAnimationFrame(follow);
        return () => cancelAnimationFrame(frame);
    }, [active, onScrolled, ref]);
}
