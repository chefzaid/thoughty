import { useEffect } from 'react';

import { takeSharedContent, type SharedContent } from '../../utils/shareTarget';

/**
 * Fills the composer with what was shared to the installed app (see `captureSharedContent`), once the
 * composer's draft is loaded, so a draft that comes back is not replaced without asking. What was shared
 * is taken from this tab's storage as it goes into the composer, so it is used only once.
 */
export function useShareTargetSeed(ready: boolean, shareInto: (shared: SharedContent) => void): void {
  useEffect(() => {
    if (!ready) return;
    const shared = takeSharedContent();
    if (shared) shareInto(shared);
  }, [ready, shareInto]);
}
