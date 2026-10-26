import type { SyncScheduleConfig, SyncFrequency } from '../../services/api/cloudSyncService';
import { formatDate, type ExportFormat } from './cloudSyncFormat';

interface CloudScheduleSectionProps {
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly schedule: SyncScheduleConfig | undefined;
    readonly frequency: SyncFrequency | undefined;
    readonly format: ExportFormat | undefined;
    readonly includeVisibility: boolean | undefined;
    readonly syncing: boolean;
    readonly onFrequencyChange: (frequency: SyncFrequency) => void;
    readonly onFormatChange: (format: ExportFormat) => void;
    readonly onToggleIncludeVisibility: () => void;
    readonly onSave: () => void;
    readonly onRemove: () => void;
    readonly onSyncNow: () => void;
}

/** Scheduled sync settings and status for one connected provider. */
function CloudScheduleSection({
    t,
    schedule,
    frequency,
    format,
    includeVisibility,
    syncing,
    onFrequencyChange,
    onFormatChange,
    onToggleIncludeVisibility,
    onSave,
    onRemove,
    onSyncNow,
}: CloudScheduleSectionProps) {
    return (
        <div className="cloud-schedule-section">
            <h4>{t('cloudSchedule')}</h4>
            <p className="cloud-schedule-description">{t('cloudScheduleDescription')}</p>

            {schedule?.enabled && (
                <div className="cloud-schedule-status active">
                    <span className="cloud-schedule-status-dot" />
                    {t('cloudScheduleEnabled')}
                </div>
            )}

            {schedule?.lastSyncAt && (
                <div className="cloud-schedule-meta">
                    {t('cloudLastSync', { date: formatDate(schedule.lastSyncAt) })}
                </div>
            )}
            {schedule?.nextSyncAt && schedule?.enabled && (
                <div className="cloud-schedule-meta">
                    {t('cloudNextSync', { date: formatDate(schedule.nextSyncAt) })}
                </div>
            )}

            <div className="cloud-upload-row">
                <label>{t('cloudScheduleFrequency')}</label>
                <select
                    value={frequency}
                    onChange={e => onFrequencyChange(e.target.value as SyncFrequency)}
                >
                    <option value="every_6h">{t('cloudScheduleEvery6h')}</option>
                    <option value="every_12h">{t('cloudScheduleEvery12h')}</option>
                    <option value="daily">{t('cloudScheduleDaily')}</option>
                    <option value="weekly">{t('cloudScheduleWeekly')}</option>
                </select>
            </div>

            <div className="cloud-upload-row">
                <label>{t('exportFormat')}</label>
                <select
                    value={format}
                    onChange={e => onFormatChange(e.target.value as ExportFormat)}
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
                        onChange={onToggleIncludeVisibility}
                    />
                    {t('includeVisibility')}
                </label>
            </div>

            <div className="cloud-schedule-actions">
                <button type="button"
                    className="cloud-btn sync"
                    onClick={onSave}
                >
                    {t('cloudScheduleEnable')}
                </button>
                {schedule?.enabled && (
                    <button type="button"
                        className="cloud-btn disconnect"
                        onClick={onRemove}
                    >
                        {t('cloudScheduleDisable')}
                    </button>
                )}
                <button type="button"
                    className="cloud-btn browse"
                    onClick={onSyncNow}
                    disabled={syncing}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {syncing ? t('cloudSyncing') : t('cloudSyncNow')}
                </button>
            </div>
        </div>
    );
}

export default CloudScheduleSection;
