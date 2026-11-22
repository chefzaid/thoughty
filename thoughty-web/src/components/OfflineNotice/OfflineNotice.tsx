import { useOnlineStatus } from './useOnlineStatus';

interface OfflineNoticeProps {
  /** Set while the session is not confirmed because Thoughty could not be reached when the app opened. */
  readonly offline: boolean;
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string) => string;
}

/**
 * Says the app is offline: the browser has no connection, or the journal opened without reaching
 * Thoughty and the session is not confirmed yet. Writing goes on meanwhile, kept on this device.
 */
export default function OfflineNotice({ offline, theme, t }: OfflineNoticeProps) {
  const online = useOnlineStatus();
  if (!offline && online) return null;
  const panelClass = theme === 'light'
    ? 'border-amber-300 bg-amber-50 text-gray-900'
    : 'border-amber-500/40 bg-amber-500/10 text-gray-100';
  return (
    <div role="status" data-testid="offline-notice" className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${panelClass}`}>
      <span className="codicon codicon-debug-disconnect mt-0.5" aria-hidden="true" />
      <p>
        <span className="font-semibold">{t('offlineNotice')}</span>
        {' '}
        <span>{t('offlineNoticeDetail')}</span>
      </p>
    </div>
  );
}
