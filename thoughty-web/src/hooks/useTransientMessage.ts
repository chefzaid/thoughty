import { useCallback, useState } from 'react';

export interface TransientMessage {
  readonly visible: boolean;
  /** Increments on every show, so a re-shown message restarts its countdown. */
  readonly showCount: number;
  readonly show: () => void;
  readonly hide: () => void;
}

/** State for a message, such as a toast, that `AutoDismiss` hides again after a while. */
export function useTransientMessage(): TransientMessage {
  const [visible, setVisible] = useState(false);
  const [showCount, setShowCount] = useState(0);

  const show = useCallback(() => {
    setVisible(true);
    setShowCount((previous) => previous + 1);
  }, []);
  const hide = useCallback(() => setVisible(false), []);

  return { visible, showCount, show, hide };
}
