import type { Language } from './translations';

/** An entry's optional place: the composer and editor field, the badge on the entry, the Profile switch and the export option. */
export type EntryLocationTranslationKey =
  | "entryLocationSetting"
  | "entryLocationSettingDescription"
  | "entryLocationLabel"
  | "entryLocationPlaceholder"
  | "entryLocationUseCurrent"
  | "entryLocationLocating"
  | "entryLocationFound"
  | "entryLocationDenied"
  | "entryLocationUnavailable"
  | "entryLocationCoordinates"
  | "entryLocationRemoveCoordinates"
  | "entryLocationNorth"
  | "entryLocationSouth"
  | "entryLocationEast"
  | "entryLocationWest"
  | "includeLocationShort"
  | "includeLocationHint";

export const entryLocationTranslations: Record<Language, Record<EntryLocationTranslationKey, string>> = {
  en: {
    entryLocationSetting: "Places on entries",
    entryLocationSettingDescription: "Offer a Place field when you write, which you type or fill from your device's location when you ask. Places stay private: never in the public feed, share links or books, and in exports only when you include them",
    entryLocationLabel: "Place",
    entryLocationPlaceholder: "Where are you? (optional)",
    entryLocationUseCurrent: "Use my location",
    entryLocationLocating: "Finding your location…",
    entryLocationFound: "Your location was added",
    entryLocationDenied: "Location access was refused. You can still type the place.",
    entryLocationUnavailable: "Your location could not be found. You can still type the place.",
    entryLocationCoordinates: "Coordinates: {coordinates}",
    entryLocationRemoveCoordinates: "Remove coordinates",
    entryLocationNorth: "N",
    entryLocationSouth: "S",
    entryLocationEast: "E",
    entryLocationWest: "W",
    includeLocationShort: "Include places",
    includeLocationHint: "Only JSON files carry the places of your entries",
  },
  fr: {
    entryLocationSetting: "Lieux des entrées",
    entryLocationSettingDescription: "Proposer un champ Lieu quand vous écrivez, que vous saisissez ou remplissez avec la position de votre appareil quand vous le demandez. Les lieux restent privés : jamais dans le fil public, les liens de partage ou les livres, et dans les exports seulement si vous les incluez",
    entryLocationLabel: "Lieu",
    entryLocationPlaceholder: "Où êtes-vous ? (facultatif)",
    entryLocationUseCurrent: "Utiliser ma position",
    entryLocationLocating: "Recherche de votre position…",
    entryLocationFound: "Votre position a été ajoutée",
    entryLocationDenied: "L'accès à la position a été refusé. Vous pouvez toujours saisir le lieu.",
    entryLocationUnavailable: "Votre position est introuvable. Vous pouvez toujours saisir le lieu.",
    entryLocationCoordinates: "Coordonnées : {coordinates}",
    entryLocationRemoveCoordinates: "Retirer les coordonnées",
    entryLocationNorth: "N",
    entryLocationSouth: "S",
    entryLocationEast: "E",
    entryLocationWest: "O",
    includeLocationShort: "Inclure les lieux",
    includeLocationHint: "Seuls les fichiers JSON contiennent les lieux de vos entrées",
  },
};
