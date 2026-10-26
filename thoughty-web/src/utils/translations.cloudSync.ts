import type { Language } from './translations';

/** Cloud storage providers, file upload and download, and scheduled sync. */
export type CloudSyncTranslationKey =
  | "cloudSync"
  | "cloudSyncDescription"
  | "cloudConnect"
  | "cloudConnecting"
  | "cloudConnected"
  | "cloudConnectError"
  | "cloudDisconnect"
  | "cloudDisconnected"
  | "cloudDisconnectError"
  | "cloudStatusConnected"
  | "cloudStatusDisconnected"
  | "cloudUpload"
  | "cloudUploading"
  | "cloudUploadSuccess"
  | "cloudUploadError"
  | "cloudUploadOptions"
  | "cloudDownload"
  | "cloudDownloadSuccess"
  | "cloudDownloadError"
  | "cloudBrowseFiles"
  | "cloudFilesInCloud"
  | "cloudNoFiles"
  | "cloudListFilesError"
  | "cloudSchedule"
  | "cloudScheduleDescription"
  | "cloudScheduleFrequency"
  | "cloudScheduleEvery6h"
  | "cloudScheduleEvery12h"
  | "cloudScheduleDaily"
  | "cloudScheduleWeekly"
  | "cloudScheduleEnable"
  | "cloudScheduleDisable"
  | "cloudScheduleEnabled"
  | "cloudScheduleSaved"
  | "cloudScheduleSaveError"
  | "cloudScheduleRemoved"
  | "cloudScheduleRemoveError"
  | "cloudSyncNow"
  | "cloudSyncing"
  | "cloudSyncNoChanges"
  | "cloudSyncSuccess"
  | "cloudSyncError"
  | "cloudLastSync"
  | "cloudNextSync"
  | "cloudProviders"
  | "cloudProvidersDescription"
  | "cloudImportFromCloud"
  | "cloudSelectFileToImport";

export const cloudSyncTranslations: Record<Language, Record<CloudSyncTranslationKey, string>> = {
  en: {
    cloudSync: "Cloud Sync",
    cloudSyncDescription:
      "Connect to Google Drive or OneDrive to sync your exported journal files to the cloud.",
    cloudConnect: "Connect",
    cloudConnecting: "Connecting...",
    cloudConnected: "Connected to {provider}",
    cloudConnectError: "Failed to connect cloud provider",
    cloudDisconnect: "Disconnect",
    cloudDisconnected: "Disconnected from {provider}",
    cloudDisconnectError: "Failed to disconnect",
    cloudStatusConnected: "Connected since {date}",
    cloudStatusDisconnected: "Not connected",
    cloudUpload: "Upload Export",
    cloudUploading: "Uploading...",
    cloudUploadSuccess: "Uploaded {name} successfully",
    cloudUploadError: "Failed to upload to cloud",
    cloudUploadOptions: "Upload Options",
    cloudDownload: "Download",
    cloudDownloadSuccess: "Downloaded {name}",
    cloudDownloadError: "Failed to download from cloud",
    cloudBrowseFiles: "Browse Files",
    cloudFilesInCloud: "Files in {provider}",
    cloudNoFiles: "No files found in your cloud folder",
    cloudListFilesError: "Failed to list your cloud files",
    cloudSchedule: "Scheduled Sync",
    cloudScheduleDescription:
      "Automatically sync your journal to the cloud on a fixed schedule. Only changes since the last sync are detected — no redundant uploads.",
    cloudScheduleFrequency: "Frequency",
    cloudScheduleEvery6h: "Every 6 hours",
    cloudScheduleEvery12h: "Every 12 hours",
    cloudScheduleDaily: "Daily",
    cloudScheduleWeekly: "Weekly",
    cloudScheduleEnable: "Enable Schedule",
    cloudScheduleDisable: "Disable Schedule",
    cloudScheduleEnabled: "Scheduled sync is active",
    cloudScheduleSaved: "Sync schedule saved",
    cloudScheduleSaveError: "Failed to save sync schedule",
    cloudScheduleRemoved: "Sync schedule removed",
    cloudScheduleRemoveError: "Failed to remove sync schedule",
    cloudSyncNow: "Sync Now",
    cloudSyncing: "Syncing...",
    cloudSyncNoChanges: "No changes detected since last sync",
    cloudSyncSuccess: "Synced {name} successfully",
    cloudSyncError: "Failed to sync",
    cloudLastSync: "Last sync: {date}",
    cloudNextSync: "Next sync: {date}",
    cloudProviders: "Cloud Providers",
    cloudProvidersDescription:
      "Connect your cloud storage accounts to enable syncing and importing files.",
    cloudImportFromCloud: "Import from Cloud",
    cloudSelectFileToImport: "Select a file from your cloud storage to import",
  },
  fr: {
    cloudSync: "Synchronisation Cloud",
    cloudSyncDescription:
      "Connectez-vous à Google Drive ou OneDrive pour synchroniser vos fichiers journal exportés vers le cloud.",
    cloudConnect: "Connecter",
    cloudConnecting: "Connexion...",
    cloudConnected: "Connecté à {provider}",
    cloudConnectError: "Échec de la connexion au fournisseur cloud",
    cloudDisconnect: "Déconnecter",
    cloudDisconnected: "Déconnecté de {provider}",
    cloudDisconnectError: "Échec de la déconnexion",
    cloudStatusConnected: "Connecté depuis le {date}",
    cloudStatusDisconnected: "Non connecté",
    cloudUpload: "Exporter vers le cloud",
    cloudUploading: "Envoi en cours...",
    cloudUploadSuccess: "{name} envoyé avec succès",
    cloudUploadError: "Échec de l'envoi vers le cloud",
    cloudUploadOptions: "Options d'envoi",
    cloudDownload: "Télécharger",
    cloudDownloadSuccess: "{name} téléchargé",
    cloudDownloadError: "Échec du téléchargement depuis le cloud",
    cloudBrowseFiles: "Parcourir les fichiers",
    cloudFilesInCloud: "Fichiers dans {provider}",
    cloudNoFiles: "Aucun fichier trouvé dans votre dossier cloud",
    cloudListFilesError: "Échec de l'affichage de vos fichiers cloud",
    cloudSchedule: "Synchronisation programmée",
    cloudScheduleDescription:
      "Synchronisez automatiquement votre journal vers le cloud selon un calendrier fixe. Seuls les changements depuis la dernière synchronisation sont détectés.",
    cloudScheduleFrequency: "Fréquence",
    cloudScheduleEvery6h: "Toutes les 6 heures",
    cloudScheduleEvery12h: "Toutes les 12 heures",
    cloudScheduleDaily: "Quotidien",
    cloudScheduleWeekly: "Hebdomadaire",
    cloudScheduleEnable: "Activer la programmation",
    cloudScheduleDisable: "Désactiver la programmation",
    cloudScheduleEnabled: "La synchronisation programmée est active",
    cloudScheduleSaved: "Programmation de synchronisation enregistrée",
    cloudScheduleSaveError: "Échec de l'enregistrement de la programmation",
    cloudScheduleRemoved: "Programmation de synchronisation supprimée",
    cloudScheduleRemoveError: "Échec de la suppression de la programmation",
    cloudSyncNow: "Synchroniser maintenant",
    cloudSyncing: "Synchronisation...",
    cloudSyncNoChanges:
      "Aucun changement détecté depuis la dernière synchronisation",
    cloudSyncSuccess: "{name} synchronisé avec succès",
    cloudSyncError: "Échec de la synchronisation",
    cloudLastSync: "Dernière synchronisation : {date}",
    cloudNextSync: "Prochaine synchronisation : {date}",
    cloudProviders: "Fournisseurs Cloud",
    cloudProvidersDescription:
      "Connectez vos comptes de stockage cloud pour activer la synchronisation et l'importation de fichiers.",
    cloudImportFromCloud: "Importer depuis le Cloud",
    cloudSelectFileToImport:
      "Sélectionnez un fichier de votre stockage cloud à importer",
  },
};
