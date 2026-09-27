import { useEffect, type ReactNode } from 'react';

import type { TransientMessage } from '../../hooks/useTransientMessage';

function Countdown({ durationMs, onElapsed, children }: Readonly<{
  durationMs: number;
  onElapsed: () => void;
  children: ReactNode;
}>) {
  useEffect(() => {
    const timeoutId = globalThis.setTimeout(onElapsed, durationMs);
    return () => globalThis.clearTimeout(timeoutId);
  }, [durationMs, onElapsed]);

  return <>{children}</>;
}

/**
 * Shows a transient message and hides it `durationMs` after it is actually on screen.
 * Counting from mount (not from `show()`) keeps the message visible for the full duration
 * even when its part of the tree commits late, e.g. while lazy code is still loading.
 */
function AutoDismiss({ message, durationMs, children }: Readonly<{
  message: TransientMessage;
  durationMs: number;
  children: ReactNode;
}>) {
  if (!message.visible) return null;

  return (
    <Countdown key={message.showCount} durationMs={durationMs} onElapsed={message.hide}>
      {children}
    </Countdown>
  );
}

export default AutoDismiss;
