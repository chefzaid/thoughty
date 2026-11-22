import { useEffect } from 'react';

import type { TranslationFunction } from '../../types';
import { attachmentRejectionReason } from '../../utils/attachments';
import { takeSharedContent, type SharedContent } from '../../utils/shareTarget';
import { takeSharedFiles } from '../../serviceWorker/sharedFilesClient';

interface ShareTargetSeedOptions {
  /** Set once the composer's draft is loaded. */
  readonly ready: boolean;
  readonly shareInto: (shared: SharedContent) => void;
  /** Shows a message in the app's notice toast. */
  readonly notify: (message: string) => void;
  readonly t: TranslationFunction;
}

/** The files the composer can attach, and a message for each one it cannot. */
function sortSharedFiles(files: readonly File[], t: TranslationFunction): { accepted: File[]; refusals: string[] } {
  const accepted: File[] = [];
  const refusals: string[] = [];
  for (const file of files) {
    const reason = attachmentRejectionReason(file);
    if (reason) refusals.push(t('attachmentRejected', { reason: t(reason), name: file.name }));
    else accepted.push(file);
  }
  return { accepted, refusals };
}

/**
 * Fills the composer with what was shared to the installed app (see `captureSharedContent`), once the
 * composer's draft is loaded, so a draft that comes back is not replaced without asking. What was shared
 * is taken from this tab's storage as it goes into the composer, so it is used only once; files shared
 * with it come from the page's memory (`takeSharedFiles`), and those the composer cannot attach, or files
 * that did not survive (a reload on the way), are named in a notice.
 */
export function useShareTargetSeed({ ready, shareInto, notify, t }: ShareTargetSeedOptions): void {
  useEffect(() => {
    if (!ready) return;
    const shared = takeSharedContent();
    if (!shared) return;
    if (shared.notReceived) {
      notify(t('shareTargetNotReceived'));
      return;
    }
    const { title, text } = shared;
    if (!shared.withFiles) {
      shareInto({ title, text });
      return;
    }
    // Not cancelled on a re-run: what was shared has left the tab's storage, so this run delivers it
    void takeSharedFiles().then((received) => {
      const { accepted, refusals } = sortSharedFiles(received, t);
      if (received.length === 0) notify(t('shareTargetFilesLost'));
      else if (refusals.length > 0) notify(refusals.join(' '));
      if (text.trim() || accepted.length > 0) shareInto({ title, text, files: accepted });
    });
  }, [notify, ready, shareInto, t]);
}
