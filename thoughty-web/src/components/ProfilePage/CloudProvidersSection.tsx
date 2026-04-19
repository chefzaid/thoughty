import React, { useState, useEffect, useCallback } from 'react';
import type { TranslationFunction } from './types';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_ICONS, CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';

interface CloudProvidersSectionProps {
  t: TranslationFunction;
  isDark: boolean;
}

interface CloudProviderStatus {
  connected: boolean;
  connectedAt?: string;
}

const PROVIDER_CONFIG: Record<CloudProviderType, { name: string }> = {
  google_drive: { name: CLOUD_PROVIDER_NAMES.google_drive },
  onedrive: { name: CLOUD_PROVIDER_NAMES.onedrive },
  dropbox: { name: CLOUD_PROVIDER_NAMES.dropbox },
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

const getProviderStatusText = (
  isConnected: boolean,
  connectedAt: string | undefined,
  t: TranslationFunction,
): string => {
  if (!isConnected) {
    return t('cloudStatusDisconnected');
  }

  return t('cloudStatusConnected', { date: connectedAt ? formatDate(connectedAt) : '' });
};

const getProviderButtonStyle = (
  isConnected: boolean,
  isDark: boolean,
  isDisabled: boolean,
): React.CSSProperties => {
  if (isConnected) {
    return {
      cursor: 'pointer',
      background: isDark ? '#3b1111' : '#fef2f2',
      color: isDark ? '#fca5a5' : '#dc2626',
      border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
      padding: '0.35rem 0.75rem',
      borderRadius: '6px',
      fontSize: '0.8rem',
      fontWeight: 500,
      width: '100%',
    };
  }

  return {
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    background: isDark ? 'linear-gradient(135deg, #4338ca, #6d28d9)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#f8fafc',
    border: 'none',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 500,
    opacity: isDisabled ? 0.6 : 1,
    width: '100%',
  };
};

const getProviderCardStyle = (isConnected: boolean, isDark: boolean): React.CSSProperties => {
  let borderColor = '#e5e7eb';

  if (isConnected) {
    borderColor = isDark ? 'rgba(34,197,94,0.4)' : 'rgba(34,197,94,0.5)';
  } else if (isDark) {
    borderColor = '#374151';
  }

  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    borderRadius: '12px',
    border: `1px solid ${borderColor}`,
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    flex: 1,
    textAlign: 'center',
  };
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
  const IconComponent = CLOUD_PROVIDER_ICONS[provider];
  const isConnected = providerStatus?.connected ?? false;
  const statusText = getProviderStatusText(isConnected, providerStatus?.connectedAt, t);
  const isConnecting = connecting === provider;
  const buttonStyle = getProviderButtonStyle(isConnected, isDark, isConnecting);
  const cardStyle = getProviderCardStyle(isConnected, isDark);

  return (
    <div style={cardStyle}>
      {IconComponent && <IconComponent width={28} height={28} />}
      <span className="setting-label" style={{ fontSize: '0.85rem' }}>{config.name}</span>
      <span className="setting-description" style={{ fontSize: '0.7rem' }}>{statusText}</span>
      {isConnected ? (
        <button type="button" onClick={() => onDisconnect(provider)} style={buttonStyle}>
          {t('cloudDisconnect')}
        </button>
      ) : (
        <button type="button" onClick={() => onConnect(provider)} disabled={isConnecting} style={buttonStyle}>
          {isConnecting ? t('cloudConnecting') : t('cloudConnect')}
        </button>
      )}
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
      const popup = globalThis.open(authUrl, 'cloud-oauth', `width=${width},height=${height},left=${left},top=${top}`);
      // Poll for popup close to reset connecting state
      if (popup) {
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer);
            setConnecting(current => current === provider ? null : current);
          }
        }, 500);
      }
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
          <div style={{ display: 'flex', gap: '1rem' }}>
            {(Object.keys(PROVIDER_CONFIG) as CloudProviderType[]).map(provider => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CloudProvidersSection;
