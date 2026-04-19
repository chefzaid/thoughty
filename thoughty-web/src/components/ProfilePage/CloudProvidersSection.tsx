import { useState, useEffect, useCallback } from 'react';
import type { TranslationFunction } from './types';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudProviderType } from '../../services/api/cloudSyncService';

interface CloudProvidersSectionProps {
  t: TranslationFunction;
  isDark: boolean;
}

interface CloudProviderStatus {
  connected: boolean;
  connectedAt?: string;
}

const PROVIDER_CONFIG: Record<CloudProviderType, { name: string; icon: string }> = {
  google_drive: { name: 'Google Drive', icon: '📁' },
  onedrive: { name: 'OneDrive', icon: '☁️' },
  dropbox: { name: 'Dropbox', icon: '📦' },
};

const getMessageStyle = (type: 'success' | 'error', isDark: boolean) => {
  const successBg = isDark ? '#0b2e1a' : '#f0fdf4';
  const errorBg = isDark ? '#3b1111' : '#fef2f2';
  const successColor = isDark ? '#86efac' : '#15803d';
  const errorColor = isDark ? '#fca5a5' : '#dc2626';
  const successBorder = isDark ? '#14532d' : '#bbf7d0';
  const errorBorder = isDark ? '#7f1d1d' : '#fecaca';

  return {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    marginBottom: '0.75rem',
    fontSize: '0.85rem',
    background: type === 'success' ? successBg : errorBg,
    color: type === 'success' ? successColor : errorColor,
    border: `1px solid ${type === 'success' ? successBorder : errorBorder}`,
  };
};

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

interface ProviderRowProps {
  provider: CloudProviderType;
  providerStatus: CloudProviderStatus | undefined;
  connecting: CloudProviderType | null;
  isDark: boolean;
  t: TranslationFunction;
  onConnect: (provider: CloudProviderType) => void;
  onDisconnect: (provider: CloudProviderType) => void;
}

function ProviderRow({ provider, providerStatus, connecting, isDark, t, onConnect, onDisconnect }: Readonly<ProviderRowProps>) {
  const config = PROVIDER_CONFIG[provider];
  const isConnected = providerStatus?.connected ?? false;
  const statusText = isConnected
    ? t('cloudStatusConnected', { date: providerStatus?.connectedAt ? formatDate(providerStatus.connectedAt) : '' })
    : t('cloudStatusDisconnected');

  const disconnectStyle = {
    cursor: 'pointer' as const,
    background: isDark ? '#3b1111' : '#fef2f2',
    color: isDark ? '#fca5a5' : '#dc2626',
    border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
    padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 as const,
  };

  const connectStyle = {
    cursor: (connecting === provider ? 'not-allowed' : 'pointer') as const,
    background: isDark ? 'linear-gradient(135deg, #4338ca, #6d28d9)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#f8fafc', border: 'none',
    padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 as const,
    opacity: connecting === provider ? 0.6 : 1,
  };

  return (
    <div className="setting-row" style={{ alignItems: 'center' }}>
      <div className="setting-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{config.icon}</span>
        <div>
          <span className="setting-label">{config.name}</span>
          <span className="setting-description">{statusText}</span>
        </div>
      </div>
      <div>
        {isConnected ? (
          <button type="button" onClick={() => onDisconnect(provider)} style={disconnectStyle}>
            {t('cloudDisconnect')}
          </button>
        ) : (
          <button type="button" onClick={() => onConnect(provider)} disabled={connecting === provider} style={connectStyle}>
            {connecting === provider ? t('cloudConnecting') : t('cloudConnect')}
          </button>
        )}
      </div>
    </div>
  );
}

function CloudProvidersSection({ t, isDark }: Readonly<CloudProvidersSectionProps>) {
  const { cloudSyncService } = useApiServices();
  const [status, setStatus] = useState<Record<string, CloudProviderStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<CloudProviderType | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    const data = await cloudSyncService.getStatus();
    if (data) setStatus(data as unknown as Record<string, CloudProviderStatus>);
    setLoading(false);
  }, [cloudSyncService]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'cloud-oauth-callback') return;
      const { provider, code } = event.data;
      if (!provider || !code) return;

      setConnecting(provider);
      const redirectUri = `${globalThis.location.origin}/cloud-callback`;
      const success = await cloudSyncService.connect(provider, code, redirectUri);
      if (success) {
        setMessage({ type: 'success', text: t('cloudConnected', { provider: PROVIDER_CONFIG[provider as CloudProviderType]?.name || provider }) });
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: t('cloudConnectError') });
      }
      setConnecting(null);
      setTimeout(() => setMessage(null), 4000);
    };

    globalThis.addEventListener('message', handleMessage);
    return () => globalThis.removeEventListener('message', handleMessage);
  }, [cloudSyncService, fetchStatus, t]);

  const handleConnect = async (provider: CloudProviderType) => {
    setConnecting(provider);
    const redirectUri = `${globalThis.location.origin}/cloud-callback`;
    const authUrl = await cloudSyncService.getAuthUrl(provider, redirectUri);
    if (authUrl) {
      const width = 600;
      const height = 700;
      const left = globalThis.screenX + (globalThis.outerWidth - width) / 2;
      const top = globalThis.screenY + (globalThis.outerHeight - height) / 2;
      globalThis.open(authUrl, 'cloud-oauth', `width=${width},height=${height},left=${left},top=${top}`);
    } else {
      setMessage({ type: 'error', text: t('cloudConnectError') });
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: CloudProviderType) => {
    const success = await cloudSyncService.disconnect(provider);
    if (success) {
      setMessage({ type: 'success', text: t('cloudDisconnected', { provider: PROVIDER_CONFIG[provider]?.name || provider }) });
      await fetchStatus();
    } else {
      setMessage({ type: 'error', text: t('cloudDisconnectError') });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <h3 className="section-title">{t('cloudProviders')}</h3>
      </div>
      <div className="section-content">
        <p className="setting-description" style={{ marginBottom: '1rem' }}>
          {t('cloudProvidersDescription')}
        </p>

        {message && (
          <div className={`cloud-provider-message ${message.type}`} style={getMessageStyle(message.type, isDark)}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div>{t('loading')}...</div>
        ) : (
          (Object.keys(PROVIDER_CONFIG) as CloudProviderType[]).map(provider => (
            <ProviderRow
              key={provider}
              provider={provider}
              providerStatus={status[provider]}
              connecting={connecting}
              isDark={isDark}
              t={t}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default CloudProvidersSection;
