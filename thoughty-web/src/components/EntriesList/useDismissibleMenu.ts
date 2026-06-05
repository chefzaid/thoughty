import { useEffect, type RefObject } from 'react';

export default function useDismissibleMenu(
    menuOpen: boolean,
    menuRef: RefObject<HTMLDivElement | null>,
    onClose: () => void,
) {
    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
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