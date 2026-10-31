import { useCallback, useEffect, useRef } from 'react';

/**
 * Whether the reader's last input was the keyboard rather than a pointer, read when needed (not during
 * render), e.g. to move focus to a control that just appeared only for someone navigating by keyboard.
 */
export function useKeyboardModality(): () => boolean {
  const usingKeyboard = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) usingKeyboard.current = true;
    };
    const onPointerDown = () => { usingKeyboard.current = false; };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, []);

  return useCallback(() => usingKeyboard.current, []);
}
