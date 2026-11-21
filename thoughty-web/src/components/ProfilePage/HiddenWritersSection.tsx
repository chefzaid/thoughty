import { useEffect, useState } from 'react';

import { useFeedService } from '../../hooks/useFeedService';
import type { HiddenWriter, HiddenWriters } from '../../services/api';
import type { TranslationFunction } from './types';
import './HiddenWritersSection.css';

interface HiddenWritersSectionProps {
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

type Kind = keyof HiddenWriters;

const KINDS: ReadonlyArray<{ kind: Kind; title: string; action: string; label: string }> = [
  { kind: 'muted', title: 'mutedWritersTitle', action: 'unmuteWriter', label: 'unmuteWriterLabel' },
  { kind: 'blocked', title: 'blockedWritersTitle', action: 'unblockWriter', label: 'unblockWriterLabel' },
];

/** The writers muted and blocked from the feed, each to unmute or unblock (Profile › Privacy). */
function HiddenWritersSection({ isDark, t }: HiddenWritersSectionProps) {
  const feedService = useFeedService();
  const [writers, setWriters] = useState<HiddenWriters | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState(false);

  useEffect(() => {
    let active = true;
    void feedService.fetchHiddenWriters().then(({ data }) => {
      if (!active) return;
      const valid = Array.isArray(data?.muted) && Array.isArray(data?.blocked);
      setWriters(valid ? data : null);
      setLoadError(!valid);
    });
    return () => {
      active = false;
    };
  }, [feedService]);

  const undo = async (kind: Kind, writer: HiddenWriter) => {
    setBusyId(`${kind}:${writer.id}`);
    setUpdateError(false);
    const result = kind === 'muted'
      ? await feedService.setWriterMuted(writer.id, false)
      : await feedService.setWriterBlocked(writer.id, false);
    setBusyId(null);
    if (!result.data) {
      setUpdateError(true);
      return;
    }
    setWriters((current) => current && {
      ...current,
      [kind]: current[kind].filter((candidate) => candidate.id !== writer.id),
    });
  };

  const empty = writers !== null && writers.muted.length === 0 && writers.blocked.length === 0;

  return (
    <div className="setting-row hidden-writers">
      <div className="setting-info">
        <span className="setting-label">{t('hiddenWriters')}</span>
        <span className="setting-description">{t('hiddenWritersDescription')}</span>
      </div>
      {writers === null && !loadError && <span className="setting-description">{t('loading')}...</span>}
      {loadError && <div className="password-error" role="alert">{t('hiddenWritersLoadError')}</div>}
      {empty && <span className="setting-description">{t('hiddenWritersEmpty')}</span>}
      {writers && KINDS.filter(({ kind }) => writers[kind].length > 0).map(({ kind, title, action, label }) => (
        <div key={kind} className="hidden-writers-group">
          <h3 className="setting-label">{t(title)}</h3>
          <ul aria-label={t(title)}>
            {writers[kind].map((writer) => (
              <li key={writer.id}>
                <span className="hidden-writers-name">{writer.username}</span>
                <button
                  type="button"
                  className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
                  aria-label={t(label, { username: writer.username })}
                  disabled={busyId !== null}
                  onClick={() => void undo(kind, writer)}
                >
                  {t(action)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {updateError && <div className="password-error" role="alert">{t('hiddenWriterUpdateError')}</div>}
    </div>
  );
}

export default HiddenWritersSection;
