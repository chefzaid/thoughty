import './CloudSync.css';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_ICONS } from '../CloudProviderIcons';
import CloudFilesSection from './CloudFilesSection';
import CloudScheduleSection from './CloudScheduleSection';
import { PROVIDER_CONFIG, formatDate, type ExportFormat } from './cloudSyncFormat';
import { useCloudSync } from './useCloudSync';

interface CloudSyncProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
}

function CloudSync({ theme, t, diaryId }: CloudSyncProps) {
    const {
        status,
        loading,
        connecting,
        uploading,
        message,
        exportFormat,
        setExportFormat,
        includeVisibility,
        setIncludeVisibility,
        expandedProvider,
        files,
        loadingFiles,
        downloading,
        schedules,
        scheduleFrequency,
        setScheduleFrequency,
        scheduleFormat,
        setScheduleFormat,
        scheduleIncludeVisibility,
        setScheduleIncludeVisibility,
        syncing,
        handleSaveSchedule,
        handleRemoveSchedule,
        handleSyncNow,
        handleConnect,
        handleDisconnect,
        handleUpload,
        handleBrowseFiles,
        handleDownload,
    } = useCloudSync(t, diaryId);

    const isLight = theme === 'light';

    if (loading) {
        return <div className={`cloud-sync ${isLight ? 'light' : 'dark'}`}>{t('loading')}...</div>;
    }

    return (
        <div className={`cloud-sync ${isLight ? 'light' : 'dark'}`}>
            <h3>{t('cloudSync')}</h3>
            <p className="cloud-sync-description">{t('cloudSyncDescription')}</p>

            {message && (
                <div className={`cloud-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="cloud-providers">
                {(Object.keys(PROVIDER_CONFIG) as CloudProviderType[]).map(provider => {
                    const config = PROVIDER_CONFIG[provider];
                    const providerStatus = status[provider];
                    const isConnected = providerStatus?.connected ?? false;
                    const IconComponent = CLOUD_PROVIDER_ICONS[provider];

                    return (
                        <div key={provider} className={`cloud-provider-card ${isConnected ? 'connected' : ''}`}>
                            <div className="cloud-provider-header">
                                <div className="cloud-provider-icon">{IconComponent && <IconComponent width={24} height={24} />}</div>
                                <div className="cloud-provider-info">
                                    <div className="cloud-provider-name">{config.name}</div>
                                    <div className={`cloud-provider-status ${isConnected ? 'connected' : ''}`}>
                                        {isConnected
                                            ? t('cloudStatusConnected', { date: providerStatus?.connectedAt ? formatDate(providerStatus.connectedAt) : '' })
                                            : t('cloudStatusDisconnected')
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="cloud-provider-actions">
                                {isConnected ? (
                                    <>
                                        <button type="button"
                                            className="cloud-btn sync"
                                            onClick={() => handleUpload(provider)}
                                            disabled={uploading === provider}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            {uploading === provider ? t('cloudUploading') : t('cloudUpload')}
                                        </button>
                                        <button type="button"
                                            className="cloud-btn browse"
                                            onClick={() => handleBrowseFiles(provider)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                            {t('cloudBrowseFiles')}
                                        </button>
                                        <button type="button"
                                            className="cloud-btn disconnect"
                                            onClick={() => handleDisconnect(provider)}
                                        >
                                            {t('cloudDisconnect')}
                                        </button>
                                    </>
                                ) : (
                                    <button type="button"
                                        className="cloud-btn connect"
                                        onClick={() => handleConnect(provider)}
                                        disabled={connecting === provider}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        {connecting === provider ? t('cloudConnecting') : t('cloudConnect')}
                                    </button>
                                )}
                            </div>

                            {/* Upload options shown when connected */}
                            {isConnected && (
                                <div className="cloud-upload-options">
                                    <h4>{t('cloudUploadOptions')}</h4>
                                    <div className="cloud-upload-row">
                                        <label>{t('exportFormat')}</label>
                                        <select
                                            value={exportFormat}
                                            onChange={e => setExportFormat(e.target.value as ExportFormat)}
                                        >
                                            <option value="txt">{t('formatTxt')}</option>
                                            <option value="json">{t('formatJson')}</option>
                                            <option value="md">{t('formatMd')}</option>
                                        </select>
                                    </div>
                                    <div className="cloud-upload-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={includeVisibility}
                                                onChange={() => setIncludeVisibility(!includeVisibility)}
                                            />
                                            {t('includeVisibility')}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Scheduled Sync section shown when connected */}
                            {isConnected && (
                                <CloudScheduleSection
                                    t={t}
                                    schedule={schedules[provider]}
                                    frequency={scheduleFrequency[provider]}
                                    format={scheduleFormat[provider]}
                                    includeVisibility={scheduleIncludeVisibility[provider]}
                                    syncing={syncing === provider}
                                    onFrequencyChange={frequency => setScheduleFrequency(prev => ({ ...prev, [provider]: frequency }))}
                                    onFormatChange={format => setScheduleFormat(prev => ({ ...prev, [provider]: format }))}
                                    onToggleIncludeVisibility={() => setScheduleIncludeVisibility(prev => ({ ...prev, [provider]: !prev[provider] }))}
                                    onSave={() => handleSaveSchedule(provider)}
                                    onRemove={() => handleRemoveSchedule(provider)}
                                    onSyncNow={() => handleSyncNow(provider)}
                                />
                            )}

                            {/* Files list */}
                            {expandedProvider === provider && (
                                <CloudFilesSection
                                    t={t}
                                    providerName={config.name}
                                    files={files}
                                    loading={loadingFiles}
                                    downloadingFileId={downloading}
                                    onDownload={file => handleDownload(provider, file)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CloudSync;
