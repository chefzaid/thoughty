import { useCallback, useState } from 'react';

import type { FeedService, PublicFeedAuthor } from '../../services/api';

type Writer = Pick<PublicFeedAuthor, 'id' | 'username'>;

/**
 * Mutes and blocks writers from the feed. A block asks first (`pendingBlock` until confirmed). Once either
 * is saved the writer joins `hiddenIds`, so their entries and comments leave the page at once, and
 * `onHidden` lets the page drop what it holds of them; the notice says where to undo it.
 */
export function useWriterControls(
  feedService: FeedService,
  onHidden: (writer: Writer, blocked: boolean) => void,
) {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  const [pendingBlock, setPendingBlock] = useState<Writer | null>(null);
  const [notice, setNotice] = useState<{ key: 'writerMuted' | 'writerBlocked'; username: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hide = useCallback(async (writer: Writer, block: boolean) => {
    setNotice(null);
    setError(null);
    setPendingIds((current) => new Set(current).add(writer.id));
    const result = block
      ? await feedService.setWriterBlocked(writer.id, true)
      : await feedService.setWriterMuted(writer.id, true);
    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(writer.id);
      return next;
    });
    if (!result.data) {
      setError(result.error || (block ? 'writerBlockError' : 'writerMuteError'));
      return;
    }
    setHiddenIds((current) => new Set(current).add(writer.id));
    setNotice({ key: block ? 'writerBlocked' : 'writerMuted', username: writer.username });
    onHidden(writer, block);
  }, [feedService, onHidden]);

  const mute = useCallback((writer: Writer) => void hide(writer, false), [hide]);

  const confirmBlock = useCallback(() => {
    const writer = pendingBlock;
    setPendingBlock(null);
    if (writer) void hide(writer, true);
  }, [hide, pendingBlock]);

  return {
    hiddenIds,
    pendingIds,
    pendingBlock,
    /** What was just done, to say with the writer's name. */
    notice,
    error,
    mute,
    requestBlock: setPendingBlock,
    cancelBlock: () => setPendingBlock(null),
    confirmBlock,
  };
}
