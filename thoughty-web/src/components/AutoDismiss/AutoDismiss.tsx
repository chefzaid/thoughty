import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';

import type { TransientMessage } from '../../hooks/useTransientMessage';

function Countdown({ durationMs, onElapsed, pauseWhileEngaged, children }: Readonly<{
  durationMs: number;
  onElapsed: () => void;
  pauseWhileEngaged: boolean;
  children: ReactNode;
}>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return undefined;
    const timeoutId = globalThis.setTimeout(onElapsed, durationMs);
    return () => globalThis.clearTimeout(timeoutId);
  }, [durationMs, onElapsed, paused]);

  if (!pauseWhileEngaged) return <>{children}</>;

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      {children}
    </div>
  );
}

/**
 * Shows a transient message and hides it `durationMs` after it is actually on screen.
 * Counting from mount (not from `show()`) keeps the message visible for the full duration
 * even when its part of the tree commits late, e.g. while lazy code is still loading.
 * With `pauseWhileEngaged` the countdown stops while the pointer is over the message or focus
 * is inside it, and starts over in full once both leave (WCAG 2.2.1, Timing Adjustable).
 */
function AutoDismiss({ message, durationMs, pauseWhileEngaged = false, children }: Readonly<{
  message: TransientMessage;
  durationMs: number;
  pauseWhileEngaged?: boolean;
  children: ReactNode;
}>) {
  if (!message.visible) return null;

  return (
    <Countdown key={message.showCount} durationMs={durationMs} onElapsed={message.hide} pauseWhileEngaged={pauseWhileEngaged}>
      {children}
    </Countdown>
  );
}

export default AutoDismiss;
