import { useCallback, useRef } from 'react';

import { useSpeech, type SpeechEntry } from '../../hooks/useSpeech';
import type { PublicFeedEntry } from '../../services/api';
import { detectSpeechLanguage } from '../../utils/speechLanguage';

interface FeedSpeechOptions {
  readonly entries: PublicFeedEntry[];
  readonly hasMore: boolean;
  /** Loads the next feed page and resolves to its entries (empty on failure or a stale request). */
  readonly fetchNextPage: () => Promise<PublicFeedEntry[]>;
  readonly language: string;
  readonly readDates: boolean;
  readonly voiceUri?: string;
}

/** What is read aloud for a feed entry: its title and text, in the language the text appears to be written in. */
export function toFeedSpeechEntry(entry: PublicFeedEntry): SpeechEntry {
  const content = [entry.title, entry.content].filter(Boolean).join('. ');
  return {
    id: entry.id,
    content,
    date: entry.date,
    language: detectSpeechLanguage(content) ?? undefined,
  };
}

/**
 * The Journal's reading controls for the feed: reads one entry, or reads on from an entry through the
 * loaded entries and then through the next pages, which it loads the way the infinite scroll does.
 */
export function useFeedSpeech({ entries, hasMore, fetchNextPage, language, readDates, voiceUri }: FeedSpeechOptions) {
  const speech = useSpeech({ language, readDates, voiceUri });
  const latestRef = useRef({ entries, hasMore, fetchNextPage });
  latestRef.current = { entries, hasMore, fetchNextPage };

  const loadMore = useCallback(async (afterId: number): Promise<SpeechEntry[]> => {
    const latest = latestRef.current;
    const index = latest.entries.findIndex((entry) => entry.id === afterId);
    // The entry left the list (the scope changed): there is nothing to read on to.
    if (index === -1) return [];
    const loaded = latest.entries.slice(index + 1);
    if (loaded.length > 0 || !latest.hasMore) return loaded.map(toFeedSpeechEntry);
    return (await latest.fetchNextPage()).map(toFeedSpeechEntry);
  }, []);

  const { speakEntry, speakFromEntry } = speech;
  const readEntry = useCallback((entry: PublicFeedEntry) => speakEntry(toFeedSpeechEntry(entry)), [speakEntry]);
  const readFromEntry = useCallback((entry: PublicFeedEntry) => {
    speakFromEntry(latestRef.current.entries.map(toFeedSpeechEntry), entry.id, loadMore);
  }, [loadMore, speakFromEntry]);

  return {
    supported: speech.supported,
    speaking: speech.speaking,
    activeEntryId: speech.activeEntryId,
    readEntry,
    readFromEntry,
    stop: speech.stop,
  };
}
