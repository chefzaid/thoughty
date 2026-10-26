import type { Language } from './translations';

/** The profile and settings page: personal details, profile picture, appearance, reading voice and journal preferences. */
export type SettingsTranslationKey =
  | "fullName"
  | "fullNameDescription"
  | "enterYourFullName"
  | "email"
  | "emailDescription"
  | "enterYourEmail"
  | "bio"
  | "bioDescription"
  | "writeSomethingAboutYourself"
  | "birthday"
  | "birthdayDescription"
  | "gender"
  | "genderDescription"
  | "genderNotSpecified"
  | "genderMale"
  | "genderFemale"
  | "genderOther"
  | "changeProfilePicture"
  | "editProfilePicture"
  | "profilePictureAlt"
  | "profilePicturePreview"
  | "profilePictureZoom"
  | "clickToUpload"
  | "maxFileSize"
  | "changeImage"
  | "theme"
  | "themeDescription"
  | "fontType"
  | "fontTypeDescription"
  | "fontTypeSystem"
  | "fontTypeSerif"
  | "fontTypeModern"
  | "fontTypeMono"
  | "fontSize"
  | "fontSizeDescription"
  | "fontColor"
  | "fontColorDescription"
  | "highContrast"
  | "highContrastDescription"
  | "fontPreview"
  | "fontPreviewDescription"
  | "fontPreviewKicker"
  | "fontPreviewSample"
  | "ttsVoice"
  | "ttsVoiceDescription"
  | "ttsVoiceDefault"
  | "ttsVoiceSystemLabel"
  | "previewTtsVoice"
  | "previewingTtsVoice"
  | "ttsVoicePreviewSample"
  | "entriesPerPage"
  | "entriesPerPageDescription"
  | "maxPinnedEntries"
  | "maxPinnedEntriesDescription"
  | "defaultVisibility"
  | "language"
  | "toggleTheme"
  | "saveSettings"
  | "settingsSaved"
  | "settingsSaveFailed"
  | "personalInfo"
  | "appearance"
  | "memberSince"
  | "readDates"
  | "readDatesDescription"
  | "markdownEnabled"
  | "markdownDisabled";

export const settingsTranslations: Record<Language, Record<SettingsTranslationKey, string>> = {
  en: {
    fullName: "Full Name",
    fullNameDescription: "Your full name as you want it displayed",
    enterYourFullName: "Enter your full name",
    email: "Email",
    emailDescription: "Your email address for account notifications",
    enterYourEmail: "Enter your email",
    bio: "Bio",
    bioDescription: "A short description about yourself",
    writeSomethingAboutYourself: "Write something about yourself...",
    birthday: "Birthday",
    birthdayDescription: "Your date of birth",
    gender: "Gender",
    genderDescription: "Optional",
    genderNotSpecified: "Prefer not to say",
    genderMale: "Male",
    genderFemale: "Female",
    genderOther: "Other",
    changeProfilePicture: "Change profile picture",
    editProfilePicture: "Edit Profile Picture",
    profilePictureAlt: "Profile picture",
    profilePicturePreview: "Profile picture preview",
    profilePictureZoom: "Zoom",
    clickToUpload: "Click to upload an image",
    maxFileSize: "Maximum file size: 5MB",
    changeImage: "Choose different image",
    theme: "Theme",
    themeDescription: "Choose your preferred color scheme",
    fontType: "Font style",
    fontTypeDescription: "Pick the typeface that feels easiest to read",
    fontTypeSystem: "System UI",
    fontTypeSerif: "Classic serif",
    fontTypeModern: "Modern sans",
    fontTypeMono: "Monospace",
    fontSize: "Font size",
    fontSizeDescription: "Adjust the base text size used across the app",
    fontColor: "Font color",
    fontColorDescription: "Set a preferred text color for your interface",
    highContrast: "High contrast",
    highContrastDescription:
      "Increase outlines and contrast across the app for easier reading.",
    fontPreview: "Preview",
    fontPreviewDescription:
      "Check how your chosen type, size, and color look together before saving.",
    fontPreviewKicker: "Sample entry",
    fontPreviewSample:
      "Quiet details become easier to notice when the page matches how you like to read and write.",
    ttsVoice: "Voice for read aloud",
    ttsVoiceDescription:
      "Choose which voice Thoughty uses when reading entries aloud.",
    ttsVoiceDefault: "System default voice",
    ttsVoiceSystemLabel: "system default",
    previewTtsVoice: "Preview voice",
    previewingTtsVoice: "Previewing...",
    ttsVoicePreviewSample:
      "This is how your journal will sound when Thoughty reads it aloud.",
    entriesPerPage: "Entries per page",
    entriesPerPageDescription: "Number of entries to display per page",
    maxPinnedEntries: "Pinned entries limit",
    maxPinnedEntriesDescription:
      "Maximum entries that can stay pinned at the top of the journal",
    defaultVisibility: "Default Visibility",
    language: "Language",
    toggleTheme: "Toggle theme",
    saveSettings: "Save Changes",
    settingsSaved: "Settings saved successfully",
    settingsSaveFailed: "Your settings could not be saved, so the previous ones are back. Try again.",
    personalInfo: "Personal Information",
    appearance: "Appearance",
    memberSince: "Member since {year}",
    readDates: "Read dates aloud",
    readDatesDescription: "Include dates when reading entries aloud",
    markdownEnabled: "Markdown enabled - click to switch to plain text",
    markdownDisabled: "Plain text - click to enable Markdown formatting",
  },
  fr: {
    fullName: "Nom complet",
    fullNameDescription:
      "Votre nom complet tel que vous souhaitez qu'il soit affiché",
    enterYourFullName: "Entrez votre nom complet",
    email: "Email",
    emailDescription: "Votre adresse email pour les notifications du compte",
    enterYourEmail: "Entrez votre email",
    bio: "Biographie",
    bioDescription: "Une courte description de vous-même",
    writeSomethingAboutYourself: "Écrivez quelque chose sur vous...",
    birthday: "Date de naissance",
    birthdayDescription: "Votre date de naissance",
    gender: "Genre",
    genderDescription: "Optionnel",
    genderNotSpecified: "Préfère ne pas répondre",
    genderMale: "Homme",
    genderFemale: "Femme",
    genderOther: "Autre",
    changeProfilePicture: "Changer la photo de profil",
    editProfilePicture: "Modifier la photo de profil",
    profilePictureAlt: "Photo de profil",
    profilePicturePreview: "Aperçu de la photo de profil",
    profilePictureZoom: "Zoom",
    clickToUpload: "Cliquez pour télécharger une image",
    maxFileSize: "Taille maximale du fichier : 5 Mo",
    changeImage: "Choisir une autre image",
    theme: "Thème",
    themeDescription: "Choisissez votre palette de couleurs",
    fontType: "Style de police",
    fontTypeDescription: "Choisissez la police la plus confortable à lire",
    fontTypeSystem: "Interface système",
    fontTypeSerif: "Serif classique",
    fontTypeModern: "Sans moderne",
    fontTypeMono: "Monospace",
    fontSize: "Taille du texte",
    fontSizeDescription:
      "Ajustez la taille de texte de base utilisée dans l’application",
    fontColor: "Couleur du texte",
    fontColorDescription:
      "Définissez une couleur de texte préférée pour votre interface",
    highContrast: "Contraste élevé",
    highContrastDescription:
      "Renforce les contours et le contraste dans l'application pour faciliter la lecture.",
    fontPreview: "Aperçu",
    fontPreviewDescription:
      "Vérifiez l’ensemble police, taille et couleur avant d’enregistrer.",
    fontPreviewKicker: "Exemple de note",
    fontPreviewSample:
      "Les détails calmes deviennent plus faciles à voir quand la page correspond à votre façon de lire et d’écrire.",
    ttsVoice: "Voix de lecture",
    ttsVoiceDescription:
      "Choisissez la voix que Thoughty utilise pour lire les entrées à voix haute.",
    ttsVoiceDefault: "Voix système par défaut",
    ttsVoiceSystemLabel: "par défaut",
    previewTtsVoice: "Écouter un aperçu",
    previewingTtsVoice: "Lecture...",
    ttsVoicePreviewSample:
      "Voici comment votre journal sonnera lorsque Thoughty le lira à voix haute.",
    entriesPerPage: "Entrées par page",
    entriesPerPageDescription: "Nombre d'entrées à afficher par page",
    maxPinnedEntries: "Limite des entrées épinglées",
    maxPinnedEntriesDescription:
      "Nombre maximum d'entrées qui peuvent rester épinglées en haut du journal",
    defaultVisibility: "Visibilité par défaut",
    language: "Langue",
    toggleTheme: "Changer de thème",
    saveSettings: "Enregistrer",
    settingsSaved: "Paramètres enregistrés avec succès",
    settingsSaveFailed: "Vos paramètres n'ont pas pu être enregistrés : les précédents sont rétablis. Réessayez.",
    personalInfo: "Informations personnelles",
    appearance: "Apparence",
    memberSince: "Membre depuis {year}",
    readDates: "Lire les dates à voix haute",
    readDatesDescription: "Inclure les dates lors de la lecture des entrées",
    markdownEnabled: "Markdown activé - cliquez pour passer au texte brut",
    markdownDisabled: "Texte brut - cliquez pour activer le formatage Markdown",
  },
};
