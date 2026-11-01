import { useCallback, useEffect, useRef, useState } from 'react';

export interface AnchoredPanelPosition {
    left: number;
    width: number;
    top?: number;
    bottom?: number;
}

const VIEWPORT_PADDING = 16;
const PANEL_WIDTH = 352;
const PANEL_HEIGHT = 288;

/**
 * Places a composer panel (a portal) under its button, or above it when there is no room below, and
 * keeps it there on scroll and resize. A press outside the button and the panel closes it, and so does
 * Escape, which hands focus back to the button.
 */
export function useAnchoredPanel(open: boolean, onClose: () => void) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState<AnchoredPanelPosition>({
        left: VIEWPORT_PADDING,
        top: VIEWPORT_PADDING,
        width: PANEL_WIDTH,
    });

    const updatePosition = useCallback(() => {
        const button = buttonRef.current;
        if (!button) {
            return;
        }

        const bounds = button.getBoundingClientRect();
        const width = Math.min(PANEL_WIDTH, globalThis.innerWidth - (VIEWPORT_PADDING * 2));
        const left = Math.min(
            Math.max(VIEWPORT_PADDING, bounds.left),
            globalThis.innerWidth - width - VIEWPORT_PADDING,
        );
        const opensDownward = bounds.bottom + PANEL_HEIGHT <= globalThis.innerHeight - VIEWPORT_PADDING;

        setPosition({
            left,
            width,
            ...(opensDownward
                ? { top: bounds.bottom + 8 }
                : { bottom: globalThis.innerHeight - bounds.top + 8 }),
        });
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        updatePosition();
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!anchorRef.current?.contains(target) && !panelRef.current?.contains(target)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                buttonRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        globalThis.addEventListener('keydown', handleKeyDown);
        globalThis.addEventListener('resize', updatePosition);
        globalThis.addEventListener('scroll', updatePosition, true);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            globalThis.removeEventListener('keydown', handleKeyDown);
            globalThis.removeEventListener('resize', updatePosition);
            globalThis.removeEventListener('scroll', updatePosition, true);
        };
    }, [onClose, open, updatePosition]);

    return { anchorRef, panelRef, buttonRef, position };
}
