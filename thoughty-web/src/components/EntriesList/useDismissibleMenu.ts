import { useEffect, type RefObject } from 'react';

/** Why an open menu closed: a press outside it, or Escape (after which its trigger usually takes focus back). */
export type MenuDismissReason = 'outside' | 'escape';

export default function useDismissibleMenu(
    menuOpen: boolean,
    menuRef: RefObject<HTMLDivElement | null>,
    onClose: (reason: MenuDismissReason) => void,
) {
    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose('outside');
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose('escape');
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [menuOpen, menuRef, onClose]);
}