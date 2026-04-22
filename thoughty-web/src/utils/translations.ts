export type TranslationKey =
  | 'journal'
  | 'stats'
  | 'settings'
  | 'myJournal'
  | 'whatsOnYourMind'
  | 'save'
  | 'public'
  | 'private'
  | 'publicTooltip'
  | 'privateTooltip'
  | 'copyright'
  | 'madeWithLove'
  | 'privacy'
  | 'terms'
  | 'contact'
  | 'searchPlaceholder'
  | 'filterTagsPlaceholder'
  | 'filterDatePlaceholder'
  | 'filterVisibility'
  | 'allEntries'
  | 'resetFilters'
  | 'year'
  | 'month'
  | 'goToYear'
  | 'goToMonth'
  | 'goToFirst'
  | 'go'
  | 'pageInfo'
  | 'previous'
  | 'next'
  | 'first'
  | 'last'
  | 'page'
  | 'ofTotal'
  | 'close'
  | 'backToTop'
  | 'profileName'
  | 'fullName'
  | 'fullNameDescription'
  | 'enterYourFullName'
  | 'displayName'
  | 'displayNameDescription'
  | 'email'
  | 'emailDescription'
  | 'enterYourEmail'
  | 'bio'
  | 'bioDescription'
  | 'writeSomethingAboutYourself'
  | 'birthday'
  | 'birthdayDescription'
  | 'gender'
  | 'genderDescription'
  | 'genderNotSpecified'
  | 'genderMale'
  | 'genderFemale'
  | 'genderOther'
  | 'changeProfilePicture'
  | 'editProfilePicture'
  | 'clickToUpload'
  | 'maxFileSize'
  | 'changeImage'
  | 'theme'
  | 'themeDescription'
  | 'entriesPerPage'
  | 'entriesPerPageDescription'
  | 'defaultVisibility'
  | 'defaultVisibilityDescription'
  | 'language'
  | 'tagOrganization'
  | 'tagOrganizationDescription'
  | 'tagName'
  | 'tagCategory'
  | 'tagCategoryPlaceholder'
  | 'tagColor'
  | 'renameTag'
  | 'renameTagPlaceholder'
  | 'noTagsToOrganize'
  | 'resetTagAppearance'
  | 'security'
  | 'currentPassword'
  | 'newPassword'
  | 'confirmNewPassword'
  | 'enterCurrentPassword'
  | 'enterNewPassword'
  | 'confirmNewPasswordPlaceholder'
  | 'changePassword'
  | 'changingPassword'
  | 'passwordChangeSuccess'
  | 'passwordChangeFailed'
  | 'currentAndNewPasswordRequired'
  | 'cancel'
  | 'saveSettings'
  | 'settingsSaved'
  | 'personalInfo'
  | 'appearance'
  | 'preferences'
  | 'memberSince'
  | 'entries'
  | 'tags'
  | 'enterYourName'
  | 'deleteEntryTitle'
  | 'deleteEntryMessage'
  | 'delete'
  | 'noEntriesFound'
  | 'edit'
  | 'readMore'
  | 'showLess'
  | 'totalEntries'
  | 'currentStreak'
  | 'topTags'
  | 'entriesOverTime'
  | 'tagDistribution'
  | 'loadingStats'
  | 'statsOverview'
  | 'uniqueTags'
  | 'yearsActive'
  | 'avgPerYear'
  | 'thoughtsPerYear'
  | 'thoughtsPerMonth'
  | 'topTagsByYear'
  | 'importExport'
  | 'import'
  | 'export'
  | 'exportDescription'
  | 'importDescription'
  | 'downloadExport'
  | 'includeVisibility'
  | 'includeVisibilityShort'
  | 'exportFormat'
  | 'formatTxt'
  | 'formatJson'
  | 'formatMd'
  | 'chooseFile'
  | 'previewSummary'
  | 'entriesFound'
  | 'duplicatesFound'
  | 'skipDuplicates'
  | 'confirmImport'
  | 'importing'
  | 'importSuccess'
  | 'importError'
  | 'exportSuccess'
  | 'exportError'
  | 'previewError'
  | 'formatSettings'
  | 'formatDescription'
  | 'entrySeparator'
  | 'sameDaySeparator'
  | 'datePrefix'
  | 'dateSuffix'
  | 'dateFormat'
  | 'tagOpenBracket'
  | 'tagCloseBracket'
  | 'tagSeparator'
  | 'saveFormat'
  | 'formatSaved'
  | 'formatSaveError'
  | 'loading'
  | 'dataPrivacy'
  | 'downloadMyData'
  | 'downloadMyDataDescription'
  | 'downloading'
  | 'downloadDataError'
  | 'dangerZone'
  | 'deleteAllDescription'
  | 'deleteAllEntries'
  | 'confirmDeleteAll'
  | 'deleteAllSuccess'
  | 'deleteAllError'
  | 'deleting'
  | 'user'
  | 'logout'
  | 'profile'
  | 'back'
  | 'landingEyebrow'
  | 'landingTitle'
  | 'landingSubtitle'
  | 'landingPulseLabel'
  | 'landingPulseTitle'
  | 'landingPulseBody'
  | 'landingFeatureSection'
  | 'landingFeaturePrivateTitle'
  | 'landingFeaturePrivateBody'
  | 'landingFeatureOrganizeTitle'
  | 'landingFeatureOrganizeBody'
  | 'landingFeatureExportTitle'
  | 'landingFeatureExportBody'
  | 'landingFeatureInsightTitle'
  | 'landingFeatureInsightBody'
  | 'suggestTags'
  | 'suggestingTags'
  | 'fixWriting'
  | 'fixingWriting'
  | 'discussEntry'
  | 'aiChat'
  | 'aiThinking'
  | 'aiChatPlaceholder'
  | 'aiChatError'
  | 'signIn'
  | 'signUp'
  | 'welcomeBack'
  | 'createAccount'
  | 'resetYourPassword'
  | 'password'
  | 'confirmPassword'
  | 'username'
  | 'emailOrUsername'
  | 'enterEmail'
  | 'enterEmailOrUsername'
  | 'enterPassword'
  | 'enterUsername'
  | 'confirmPasswordPlaceholder'
  | 'showPassword'
  | 'hidePassword'
  | 'orContinueWith'
  | 'continueWithGoogle'
  | 'dontHaveAccount'
  | 'alreadyHaveAccount'
  | 'emailPasswordRequired'
  | 'identifierPasswordRequired'
  | 'emailRequired'
  | 'invalidEmail'
  | 'passwordMinLength'
  | 'passwordsDoNotMatch'
  | 'authFailed'
  | 'googleSignInFailed'
  | 'forgotPassword'
  | 'sendResetLink'
  | 'backToLogin'
  | 'resetEmailSent'
  | 'forgotPasswordFailed'
  | 'deleteAccount'
  | 'deleteAccountDescription'
  | 'deleteAccountWarning'
  | 'typeDeleteToConfirm'
  | 'enterYourPassword'
  | 'confirmDelete'
  | 'deleteAccountFailed'
  | 'passwordRequired'
  | 'backToSource'
  | 'entryNotFound'
  | 'entryReferenceHint'
  | 'diaries'
  | 'manageDiaries'
  | 'newDiary'
  | 'diaryName'
  | 'diaryIcon'
  | 'diaryColor'
  | 'setAsDefault'
  | 'defaultDiary'
  | 'deleteDiary'
  | 'deleteDiaryWarning'
  | 'createDiary'
  | 'editDiary'
  | 'allDiaries'
  | 'noDiaries'
  | 'visibilityOverrideHint'
  | 'highlightsTitle'
  | 'randomThought'
  | 'onThisDay'
  | 'yearsAgo'
  | 'refreshRandom'
  | 'randomize'
  | 'highlightsError'
  | 'tryAgain'
  | 'expand'
  | 'collapse'
  | 'seeHighlights'
  | 'highlights'
  | 'noHighlights'
  | 'listen'
  | 'stopListening'
  | 'listenThisEntry'
  | 'listenFromHere'
  | 'readDates'
  | 'readDatesDescription'
  | 'markdownEnabled'
  | 'markdownDisabled'
  | 'markdownToolbar'
  | 'loadingEntries'
  | 'selectAll'
  | 'bulkModeEnter'
  | 'bulkModeExit'
  | 'bulkSelected'
  | 'bulkDelete'
  | 'bulkMakePublic'
  | 'bulkMakePrivate'
  | 'bulkAddTags'
  | 'bulkMove'
  | 'bulkClearSelection'
  | 'bulkDeleteTitle'
  | 'bulkDeleteMessage'
  | 'selectTags'
  | 'apply'
  | 'attach'
  | 'attachFiles'
  | 'attachments'
  | 'removeAttachment'
  | 'attachmentTypeNotAllowed'
  | 'attachmentTooLarge'
  | 'downloadAttachment'
  | 'closeImage'
  | 'favorite'
  | 'unfavorite'
  | 'favorites'
  | 'filterFavorites'
  | 'dragToReorder'
  | 'aiConfiguration'
  | 'aiConfigDescription'
  | 'openRouterModel'
  | 'searchModels'
  | 'noModelsFound'
  | 'loadingModels'
  | 'autoTagMaxTags'
  | 'autoTagMaxTagsDescription'
  | 'history'
  | 'viewHistory'
  | 'noRevisions'
  | 'revision'
  | 'restoredFrom'
  | 'cloudSync'
  | 'cloudSyncDescription'
  | 'cloudConnect'
  | 'cloudConnecting'
  | 'cloudConnected'
  | 'cloudConnectError'
  | 'cloudDisconnect'
  | 'cloudDisconnected'
  | 'cloudDisconnectError'
  | 'cloudStatusConnected'
  | 'cloudStatusDisconnected'
  | 'cloudUpload'
  | 'cloudUploading'
  | 'cloudUploadSuccess'
  | 'cloudUploadError'
  | 'cloudUploadOptions'
  | 'cloudDownload'
  | 'cloudDownloadSuccess'
  | 'cloudDownloadError'
  | 'cloudBrowseFiles'
  | 'cloudFilesInCloud'
  | 'cloudNoFiles'
  | 'cloudSchedule'
  | 'cloudScheduleDescription'
  | 'cloudScheduleFrequency'
  | 'cloudScheduleEvery6h'
  | 'cloudScheduleEvery12h'
  | 'cloudScheduleDaily'
  | 'cloudScheduleWeekly'
  | 'cloudScheduleEnable'
  | 'cloudScheduleDisable'
  | 'cloudScheduleEnabled'
  | 'cloudScheduleDisabled'
  | 'cloudScheduleSaved'
  | 'cloudScheduleSaveError'
  | 'cloudScheduleRemoved'
  | 'cloudScheduleRemoveError'
  | 'cloudSyncNow'
  | 'cloudSyncing'
  | 'cloudSyncNoChanges'
  | 'cloudSyncSuccess'
  | 'cloudSyncError'
  | 'cloudLastSync'
  | 'cloudNextSync'
  | 'cloudProviders'
  | 'cloudProvidersDescription'
  | 'cloudImportFromCloud'
  | 'cloudSelectFileToImport';

export type Language = 'en' | 'fr';

export type TranslationParams = Record<string, string | number>;

export type Translations = Record<Language, Record<TranslationKey, string>>;

export const translations: Translations = {
  en: {
    // App
    journal: 'Journal',
    stats: 'Stats',
    settings: 'Settings',
    myJournal: 'My Journal',
    whatsOnYourMind: "What's on your mind?",
    save: 'Save',
    public: 'Public',
    private: 'Private',
    publicTooltip: 'Public - visible to everyone',
    privateTooltip: 'Private - only you can see',
    copyright: '© {year} Thoughty. All rights reserved.',
    madeWithLove: 'Made with ❤️ in Paris',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact Us',
    searchPlaceholder: 'Search content...',
    filterTagsPlaceholder: 'Filter by tags...',
    filterDatePlaceholder: 'Filter by date',
    filterVisibility: 'Filter by visibility',
    allEntries: 'All',
    resetFilters: 'Reset Filters',
    year: 'Year',
    month: 'Month',
    goToYear: 'Go to year',
    goToMonth: 'Go to month',
    goToFirst: 'Go to first entry',
    go: 'Go',
    pageInfo: 'Page {page} of {totalPages}',
    previous: 'Previous',
    next: 'Next',
    first: 'First',
    last: 'Last',
    page: 'Page',
    ofTotal: 'of {total}',
    close: 'Close',
    backToTop: 'Back to top',

    // Settings
    profileName: 'Name',
    fullName: 'Full Name',
    fullNameDescription: 'Your full name as you want it displayed',
    enterYourFullName: 'Enter your full name',
    displayName: 'Display Name',
    displayNameDescription: 'How you want to be known in the app',
    email: 'Email',
    emailDescription: 'Your email address for account notifications',
    enterYourEmail: 'Enter your email',
    bio: 'Bio',
    bioDescription: 'A short description about yourself',
    writeSomethingAboutYourself: 'Write something about yourself...',
    birthday: 'Birthday',
    birthdayDescription: 'Your date of birth',
    gender: 'Gender',
    genderDescription: 'Optional',
    genderNotSpecified: 'Prefer not to say',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    changeProfilePicture: 'Change profile picture',
    editProfilePicture: 'Edit Profile Picture',
    clickToUpload: 'Click to upload an image',
    maxFileSize: 'Maximum file size: 5MB',
    changeImage: 'Choose different image',
    theme: 'Theme',
    themeDescription: 'Choose your preferred color scheme',
    entriesPerPage: 'Entries per page',
    entriesPerPageDescription: 'Number of entries to display per page',
    defaultVisibility: 'Default Visibility',
    defaultVisibilityDescription: 'Default visibility for new entries',
    language: 'Language',
    tagOrganization: 'Tag Organization',
    tagOrganizationDescription: 'Assign categories and colors to your existing tags so related ideas are easier to scan.',
    tagName: 'Tag name',
    tagCategory: 'Category',
    tagCategoryPlaceholder: 'Examples: Work, Health, Ideas',
    tagColor: 'Color',
    renameTag: 'Rename',
    renameTagPlaceholder: 'Rename tag',
    noTagsToOrganize: 'Create or save a few tags first, then organize them here.',
    resetTagAppearance: 'Reset',

    // Security
    security: 'Security',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    enterCurrentPassword: 'Enter your current password',
    enterNewPassword: 'Enter your new password',
    confirmNewPasswordPlaceholder: 'Confirm your new password',
    changePassword: 'Change Password',
    changingPassword: 'Changing...',
    passwordChangeSuccess: 'Password changed successfully',
    passwordChangeFailed: 'Failed to change password',
    currentAndNewPasswordRequired: 'Current and new password are required',
    cancel: 'Cancel',
    saveSettings: 'Save Changes',
    settingsSaved: 'Settings saved successfully',
    personalInfo: 'Personal Information',
    appearance: 'Appearance',
    preferences: 'Preferences',
    memberSince: 'Member since {year}',
    entries: 'Entries',
    tags: 'Tags',
    enterYourName: 'Enter your name',

    // Confirm Modal
    deleteEntryTitle: 'Delete Entry',
    deleteEntryMessage:
      'Are you sure you want to delete this entry? This action cannot be undone.',
    delete: 'Delete',

    // Entries List
    noEntriesFound: 'No entries found',
    edit: 'Edit',
    readMore: 'Read more',
    showLess: 'Show less',

    // Stats
    totalEntries: 'Total Entries',
    currentStreak: 'Current Streak',
    topTags: 'Top Tags',
    entriesOverTime: 'Entries Over Time',
    tagDistribution: 'Tag Distribution',
    loadingStats: 'Loading statistics...',
    statsOverview: 'Overview of your journal entries and tags',
    uniqueTags: 'Unique Tags',
    yearsActive: 'Years Active',
    avgPerYear: 'Avg. per Year',
    thoughtsPerYear: 'Entries per Year',
    thoughtsPerMonth: 'Entries per Month',
    topTagsByYear: 'Top Tags by Year',

    // Import/Export
    importExport: 'Import/Export',
    import: 'Import',
    export: 'Export',
    exportDescription: 'Download all journal entries from {diaryName} as a text file.',
    importDescription: 'Upload a text file to import entries into {diaryName}.',
    downloadExport: 'Download',
    includeVisibility: 'Include visibility (public/private) in export',
    includeVisibilityShort: 'Include visibility',
    exportFormat: 'Format',
    formatTxt: 'Text (.txt)',
    formatJson: 'JSON (.json)',
    formatMd: 'Markdown (.md)',
    chooseFile: 'Choose File',
    previewSummary: 'Preview Summary',
    entriesFound: 'entries found',
    duplicatesFound: 'duplicates found',
    skipDuplicates: 'Skip duplicate entries',
    confirmImport: 'Import Entries',
    importing: 'Importing...',
    importSuccess: 'Successfully imported {imported} entries ({skipped} duplicates skipped)',
    importError: 'Failed to import entries',
    exportSuccess: 'Export downloaded successfully',
    exportError: 'Failed to export entries',
    previewError: 'Failed to preview file',
    formatSettings: 'Format Settings',
    formatDescription: 'Customize the text file format for import and export.',
    entrySeparator: 'Entry Separator',
    sameDaySeparator: 'Same Day Separator',
    datePrefix: 'Date Prefix',
    dateSuffix: 'Date Suffix',
    dateFormat: 'Date Format',
    tagOpenBracket: 'Tag Open Bracket',
    tagCloseBracket: 'Tag Close Bracket',
    tagSeparator: 'Tag Separator',
    saveFormat: 'Save Format Settings',
    formatSaved: 'Format settings saved',
    formatSaveError: 'Failed to save format settings',
    loading: 'Loading',

    // Danger Zone
    dataPrivacy: 'Privacy',
    downloadMyData: 'Download My Data',
    downloadMyDataDescription: 'Download all your data as a JSON file (GDPR)',
    downloading: 'Downloading...',
    downloadDataError: 'Failed to download data. Please try again.',
    dangerZone: 'Danger Zone',
    deleteAllDescription:
      'Permanently delete all entries from {diaryName}. This action cannot be undone.',
    deleteAllEntries: 'Delete All Entries',
    confirmDeleteAll: 'Yes, Delete Everything',
    deleteAllSuccess: 'All entries have been deleted',
    deleteAllError: 'Failed to delete entries',
    deleting: 'Deleting...',

    // Auth & Profile
    user: 'User',
    logout: 'Logout',
    profile: 'Profile',
    back: 'Back',
    landingEyebrow: 'Private writing, built to stay useful',
    landingTitle: 'A journal that feels calm when you write and sharp when you search.',
    landingSubtitle:
      'Thoughty gives you structured diaries, fast import and export, rich entries, and privacy-first controls without turning journaling into admin work.',
    landingPulseLabel: 'Why people stay',
    landingPulseTitle: 'Everything important is still yours',
    landingPulseBody:
      'Keep entries portable with TXT, JSON, and Markdown exports, then bring them back with duplicate checks and diary-aware imports.',
    landingFeatureSection: 'Thoughty feature highlights',
    landingFeaturePrivateTitle: 'Private by default',
    landingFeaturePrivateBody:
      'Write freely, control visibility per entry, and download your personal data whenever you need a full export.',
    landingFeatureOrganizeTitle: 'Organized across diaries',
    landingFeatureOrganizeBody:
      'Split life into focused diaries, reorder them, mark favorites, and still browse everything together in All Diaries view.',
    landingFeatureExportTitle: 'Portable import and export',
    landingFeatureExportBody:
      'Move between TXT, JSON, and Markdown formats, preserve metadata, and keep diary names attached when exporting from All Diaries.',
    landingFeatureInsightTitle: 'Useful after the writing',
    landingFeatureInsightBody:
      'Search quickly, filter by tags and visibility, revisit highlights, and use the stats view to spot patterns over time.',
    suggestTags: 'Auto-Tags',
    suggestingTags: 'Tagging...',
    fixWriting: 'Rephrase',
    fixingWriting: 'Rephrasing...',
    discussEntry: 'Discuss with AI',
    aiChat: 'AI Chat',
    aiThinking: 'Thinking...',
    aiChatPlaceholder: 'Ask something about this entry...',
    aiChatError: 'Unable to get a response. Check your OpenRouter API key and try again.',

    // Authentication
    signIn: 'Sign In',
    signUp: 'Sign Up',
    welcomeBack: 'Welcome back',
    createAccount: 'Create your account',
    resetYourPassword: 'Reset your password',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    username: 'Username',
    emailOrUsername: 'Email or Username',
    enterEmail: 'Enter your email',
    enterEmailOrUsername: 'Enter your email or username',
    enterPassword: 'Enter your password',
    enterUsername: 'Choose a username',
    confirmPasswordPlaceholder: 'Confirm your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    orContinueWith: 'or continue with',
    continueWithGoogle: 'Continue with Google',
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: 'Already have an account?',
    emailPasswordRequired: 'Email and password are required',
    identifierPasswordRequired: 'Email/username and password are required',
    emailRequired: 'Email is required',
    invalidEmail: 'Please enter a valid email address',
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsDoNotMatch: 'Passwords do not match',
    authFailed: 'Authentication failed. Please try again.',
    googleSignInFailed: 'Google sign-in failed. Please try again.',
    forgotPassword: 'Forgot password?',
    sendResetLink: 'Send Reset Link',
    backToLogin: 'Back to Login',
    resetEmailSent: 'If an account exists with this email, a reset link will be sent.',
    forgotPasswordFailed: 'Failed to send reset email. Please try again.',

    // Delete Account
    deleteAccount: 'Delete Account',
    deleteAccountDescription: 'Permanently delete your account and all associated data',
    deleteAccountWarning:
      'This action cannot be undone. All your data will be permanently deleted.',
    typeDeleteToConfirm: 'Type DELETE to confirm',
    enterYourPassword: 'Enter your password',
    confirmDelete: 'Confirm Delete',
    deleteAccountFailed: 'Failed to delete account. Please try again.',
    passwordRequired: 'Password is required',

    // Entry Cross-References
    backToSource: 'Back to source entry',
    entryNotFound: 'Entry not found',
    entryReferenceHint:
      'Tip: Reference other entries by writing "entry (yyyy-mm-dd)" or "entry (yyyy-mm-dd--X)" where X is the index of the entry for that day',

    // Diaries
    diaries: 'Diaries',
    manageDiaries: 'Manage Diaries',
    newDiary: 'New Diary',
    diaryName: 'Diary Name',
    diaryIcon: 'Icon',
    diaryColor: 'Color',
    setAsDefault: 'Set as Default',
    defaultDiary: 'Default Diary',
    deleteDiary: 'Delete Diary',
    deleteDiaryWarning: 'Entries will be moved to your default diary.',
    createDiary: 'Create Diary',
    editDiary: 'Edit Diary',
    allDiaries: 'All Diaries',
    noDiaries: 'No diaries found. Create one to get started!',
    visibilityOverrideHint: 'Can be overridden per entry',

    // Highlights / Thought of the Day
    highlightsTitle: 'Highlights',
    randomThought: 'Random Thought',
    onThisDay: 'On This Day',
    yearsAgo: '{years} year(s) ago',
    refreshRandom: 'Get a new random thought',
    randomize: 'Randomize',
    highlightsError: 'Failed to load highlights',
    tryAgain: 'Try again',
    expand: 'Expand',
    collapse: 'Collapse',
    seeHighlights: 'See Highlights of the Day',
    highlights: 'Highlights',
    noHighlights: 'No highlights available yet. Start writing entries to see them here!',

    // Text-to-Speech
    listen: 'Listen',
    stopListening: 'Stop listening',
    listenThisEntry: 'Read this entry',
    listenFromHere: 'Read from here onwards',
    readDates: 'Read dates aloud',
    readDatesDescription: 'Include dates when reading entries aloud',
    markdownEnabled: 'Markdown enabled - click to switch to plain text',
    markdownDisabled: 'Plain text - click to enable Markdown formatting',
    markdownToolbar: 'Markdown formatting toolbar',
    loadingEntries: 'Loading entries...',
    selectAll: 'Select all',
    bulkModeEnter: 'Select',
    bulkModeExit: 'Cancel selection',
    bulkSelected: '{count} selected',
    bulkDelete: 'Delete',
    bulkMakePublic: 'Make public',
    bulkMakePrivate: 'Make private',
    bulkAddTags: 'Add tags',
    bulkMove: 'Move to diary',
    bulkClearSelection: 'Clear',
    bulkDeleteTitle: 'Delete entries',
    bulkDeleteMessage: 'Are you sure you want to delete {count} entries? This cannot be undone.',
    selectTags: 'Select tags...',
    apply: 'Apply',
    attach: 'Attach',
    attachFiles: 'Attach files',
    attachments: 'Attachments',
    removeAttachment: 'Remove attachment',
    attachmentTypeNotAllowed: 'This file type is not allowed. Allowed: images, PDF, plain text.',
    attachmentTooLarge: 'File is too large. Maximum size is 5 MB.',
    downloadAttachment: 'Download attachment',
    closeImage: 'Close image',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    favorites: 'Favorites',
    filterFavorites: 'Show favorites only',
    dragToReorder: 'Drag to reorder',
    history: 'History',
    viewHistory: 'View history',
    noRevisions: 'No previous versions',
    revision: 'Revision',
    restoredFrom: 'Restored from',
    aiConfiguration: 'AI Configuration',
    aiConfigDescription: 'AI features are powered by OpenRouter. The API key is configured on the server.',
    openRouterModel: 'Model',
    searchModels: 'Search models...',
    noModelsFound: 'No models found',
    loadingModels: 'Loading models...',
    autoTagMaxTags: 'Automatic Tag Limit',
    autoTagMaxTagsDescription: 'Set the maximum number of AI-generated tags to add when you save an entry. Use 0 to disable auto-tagging.',

    // Cloud Sync
    cloudSync: 'Cloud Sync',
    cloudSyncDescription: 'Connect to Google Drive or OneDrive to sync your exported journal files to the cloud.',
    cloudConnect: 'Connect',
    cloudConnecting: 'Connecting...',
    cloudConnected: 'Connected to {provider}',
    cloudConnectError: 'Failed to connect cloud provider',
    cloudDisconnect: 'Disconnect',
    cloudDisconnected: 'Disconnected from {provider}',
    cloudDisconnectError: 'Failed to disconnect',
    cloudStatusConnected: 'Connected since {date}',
    cloudStatusDisconnected: 'Not connected',
    cloudUpload: 'Upload Export',
    cloudUploading: 'Uploading...',
    cloudUploadSuccess: 'Uploaded {name} successfully',
    cloudUploadError: 'Failed to upload to cloud',
    cloudUploadOptions: 'Upload Options',
    cloudDownload: 'Download',
    cloudDownloadSuccess: 'Downloaded {name}',
    cloudDownloadError: 'Failed to download from cloud',
    cloudBrowseFiles: 'Browse Files',
    cloudFilesInCloud: 'Files in {provider}',
    cloudNoFiles: 'No files found in your cloud folder',
    // Cloud Sync Schedule
    cloudSchedule: 'Scheduled Sync',
    cloudScheduleDescription: 'Automatically sync your journal to the cloud on a fixed schedule. Only changes since the last sync are detected — no redundant uploads.',
    cloudScheduleFrequency: 'Frequency',
    cloudScheduleEvery6h: 'Every 6 hours',
    cloudScheduleEvery12h: 'Every 12 hours',
    cloudScheduleDaily: 'Daily',
    cloudScheduleWeekly: 'Weekly',
    cloudScheduleEnable: 'Enable Schedule',
    cloudScheduleDisable: 'Disable Schedule',
    cloudScheduleEnabled: 'Scheduled sync is active',
    cloudScheduleDisabled: 'Scheduled sync is off',
    cloudScheduleSaved: 'Sync schedule saved',
    cloudScheduleSaveError: 'Failed to save sync schedule',
    cloudScheduleRemoved: 'Sync schedule removed',
    cloudScheduleRemoveError: 'Failed to remove sync schedule',
    cloudSyncNow: 'Sync Now',
    cloudSyncing: 'Syncing...',
    cloudSyncNoChanges: 'No changes detected since last sync',
    cloudSyncSuccess: 'Synced {name} successfully',
    cloudSyncError: 'Failed to sync',
    cloudLastSync: 'Last sync: {date}',
    cloudNextSync: 'Next sync: {date}',
    cloudProviders: 'Cloud Providers',
    cloudProvidersDescription: 'Connect your cloud storage accounts to enable syncing and importing files.',
    cloudImportFromCloud: 'Import from Cloud',
    cloudSelectFileToImport: 'Select a file from your cloud storage to import',
  },
  fr: {
    // App
    journal: 'Journal',
    stats: 'Statistiques',
    settings: 'Paramètres',
    myJournal: 'Mon Journal',
    whatsOnYourMind: "Qu'avez-vous à l'esprit ?",
    save: 'Enregistrer',
    public: 'Public',
    private: 'Privé',
    publicTooltip: 'Public - visible par tous',
    privateTooltip: 'Privé - visible uniquement par vous',
    copyright: '© {year} Thoughty. Tous droits réservés.',
    madeWithLove: 'Fait avec ❤️ à Paris',
    privacy: 'Politique de confidentialité',
    terms: "Conditions d'utilisation",
    contact: 'Nous contacter',
    searchPlaceholder: 'Rechercher...',
    filterTagsPlaceholder: 'Filtrer par tags...',
    filterDatePlaceholder: 'Filtrer par date',
    filterVisibility: 'Filtrer par visibilité',
    allEntries: 'Tous',
    resetFilters: 'Réinitialiser',
    year: 'Année',
    month: 'Mois',
    goToYear: "Aller à l'année",
    goToMonth: 'Aller au mois',
    goToFirst: 'Aller à la première entrée',
    go: 'Aller',
    pageInfo: 'Page {page} sur {totalPages}',
    previous: 'Précédent',
    next: 'Suivant',
    first: 'Premier',
    last: 'Dernier',
    page: 'Page',
    ofTotal: 'sur {total}',
    close: 'Fermer',
    backToTop: 'Retour en haut',

    // Settings
    profileName: 'Nom',
    fullName: 'Nom complet',
    fullNameDescription: "Votre nom complet tel que vous souhaitez qu'il soit affiché",
    enterYourFullName: 'Entrez votre nom complet',
    displayName: "Nom d'affichage",
    displayNameDescription: "Comment vous souhaitez être connu dans l'application",
    email: 'Email',
    emailDescription: 'Votre adresse email pour les notifications du compte',
    enterYourEmail: 'Entrez votre email',
    bio: 'Biographie',
    bioDescription: 'Une courte description de vous-même',
    writeSomethingAboutYourself: 'Écrivez quelque chose sur vous...',
    birthday: 'Date de naissance',
    birthdayDescription: 'Votre date de naissance',
    gender: 'Genre',
    genderDescription: 'Optionnel',
    genderNotSpecified: 'Préfère ne pas répondre',
    genderMale: 'Homme',
    genderFemale: 'Femme',
    genderOther: 'Autre',
    changeProfilePicture: 'Changer la photo de profil',
    editProfilePicture: 'Modifier la photo de profil',
    clickToUpload: 'Cliquez pour télécharger une image',
    maxFileSize: 'Taille maximale du fichier : 5 Mo',
    changeImage: 'Choisir une autre image',
    theme: 'Thème',
    themeDescription: 'Choisissez votre palette de couleurs',
    entriesPerPage: 'Entrées par page',
    entriesPerPageDescription: "Nombre d'entrées à afficher par page",
    defaultVisibility: 'Visibilité par défaut',
    defaultVisibilityDescription: 'Visibilité par défaut pour les nouvelles entrées',
    language: 'Langue',
    tagOrganization: 'Organisation des tags',
    tagOrganizationDescription: 'Attribuez des catégories et des couleurs à vos tags existants pour repérer plus vite les idées liées.',
    tagName: 'Nom du tag',
    tagCategory: 'Catégorie',
    tagCategoryPlaceholder: 'Exemples : Travail, Santé, Idées',
    tagColor: 'Couleur',
    renameTag: 'Renommer',
    renameTagPlaceholder: 'Renommer le tag',
    noTagsToOrganize: 'Créez ou enregistrez quelques tags puis organisez-les ici.',
    resetTagAppearance: 'Réinitialiser',

    // Security
    security: 'Sécurité',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    enterCurrentPassword: 'Entrez votre mot de passe actuel',
    enterNewPassword: 'Entrez votre nouveau mot de passe',
    confirmNewPasswordPlaceholder: 'Confirmez votre nouveau mot de passe',
    changePassword: 'Changer le mot de passe',
    changingPassword: 'Modification...',
    passwordChangeSuccess: 'Mot de passe modifié avec succès',
    passwordChangeFailed: 'Échec de la modification du mot de passe',
    currentAndNewPasswordRequired: 'Le mot de passe actuel et le nouveau sont requis',
    cancel: 'Annuler',
    saveSettings: 'Enregistrer',
    settingsSaved: 'Paramètres enregistrés avec succès',
    personalInfo: 'Informations personnelles',
    appearance: 'Apparence',
    preferences: 'Préférences',
    memberSince: 'Membre depuis {year}',
    entries: 'Entrées',
    tags: 'Tags',
    enterYourName: 'Entrez votre nom',

    // Confirm Modal
    deleteEntryTitle: "Supprimer l'entrée",
    deleteEntryMessage:
      'Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.',
    delete: 'Supprimer',

    // Entries List
    noEntriesFound: 'Aucune entrée trouvée',
    edit: 'Modifier',
    readMore: 'Lire la suite',
    showLess: 'Voir moins',

    // Stats
    totalEntries: 'Total des entrées',
    currentStreak: 'Série actuelle',
    topTags: 'Tags populaires',
    entriesOverTime: 'Entrées au fil du temps',
    tagDistribution: 'Distribution des tags',
    loadingStats: 'Chargement des statistiques...',
    statsOverview: 'Aperçu de vos entrées de journal et tags',
    uniqueTags: 'Tags uniques',
    yearsActive: 'Années actives',
    avgPerYear: 'Moy. par an',
    thoughtsPerYear: 'Entrées par an',
    thoughtsPerMonth: 'Entrées par mois',
    topTagsByYear: 'Top tags par année',

    // Import/Export
    importExport: 'Import/Export',
    import: 'Importer',
    export: 'Exporter',
    exportDescription:
      'Téléchargez toutes les entrées de {diaryName} sous forme de fichier texte.',
    importDescription: 'Téléversez un fichier texte pour importer des entrées dans {diaryName}.',
    downloadExport: 'Télécharger',
    includeVisibility: 'Inclure la visibilité (public/privé) dans l\'export',
    includeVisibilityShort: 'Inclure la visibilité',
    exportFormat: 'Format',
    formatTxt: 'Texte (.txt)',
    formatJson: 'JSON (.json)',
    formatMd: 'Markdown (.md)',
    chooseFile: 'Choisir un fichier',
    previewSummary: 'Aperçu',
    entriesFound: 'entrées trouvées',
    duplicatesFound: 'doublons trouvés',
    skipDuplicates: 'Ignorer les entrées en double',
    confirmImport: 'Importer les entrées',
    importing: 'Importation...',
    importSuccess: '{imported} entrées importées avec succès ({skipped} doublons ignorés)',
    importError: "Échec de l'importation des entrées",
    exportSuccess: 'Export téléchargé avec succès',
    exportError: "Échec de l'exportation des entrées",
    previewError: "Échec de l'aperçu du fichier",
    formatSettings: 'Paramètres de format',
    formatDescription: "Personnalisez le format du fichier texte pour l'import et l'export.",
    entrySeparator: "Séparateur d'entrées",
    sameDaySeparator: 'Séparateur du même jour',
    datePrefix: 'Préfixe de date',
    dateSuffix: 'Suffixe de date',
    dateFormat: 'Format de date',
    tagOpenBracket: 'Crochet ouvrant de tag',
    tagCloseBracket: 'Crochet fermant de tag',
    tagSeparator: 'Séparateur de tags',
    saveFormat: 'Enregistrer les paramètres',
    formatSaved: 'Paramètres de format enregistrés',
    formatSaveError: "Échec de l'enregistrement des paramètres",
    loading: 'Chargement',

    // Danger Zone
    dataPrivacy: 'Confidentialité',
    downloadMyData: 'Télécharger mes données',
    downloadMyDataDescription: 'Téléchargez toutes vos données au format JSON (RGPD)',
    downloading: 'Téléchargement...',
    downloadDataError: 'Échec du téléchargement. Veuillez réessayer.',
    dangerZone: 'Zone de danger',
    deleteAllDescription:
      'Supprimer définitivement toutes les entrées de {diaryName}. Cette action est irréversible.',
    deleteAllEntries: 'Supprimer toutes les entrées',
    confirmDeleteAll: 'Oui, tout supprimer',
    deleteAllSuccess: 'Toutes les entrées ont été supprimées',
    deleteAllError: 'Échec de la suppression des entrées',
    deleting: 'Suppression...',

    // Auth & Profile
    user: 'Utilisateur',
    logout: 'Déconnexion',
    profile: 'Profil',
    back: 'Retour',
    landingEyebrow: 'Une écriture privée, pensée pour rester utile',
    landingTitle: 'Un journal apaisant à l\'écriture et précis quand il faut retrouver une idée.',
    landingSubtitle:
      'Thoughty combine journaux structurés, import et export rapides, entrées riches et contrôle de la confidentialité sans transformer l\'écriture en corvée.',
    landingPulseLabel: 'Pourquoi on y reste',
    landingPulseTitle: 'Tout ce qui compte vous appartient toujours',
    landingPulseBody:
      'Conservez vos entrées en TXT, JSON ou Markdown, puis réimportez-les avec détection des doublons et attribution intelligente aux journaux.',
    landingFeatureSection: 'Points forts de Thoughty',
    landingFeaturePrivateTitle: 'Privé par défaut',
    landingFeaturePrivateBody:
      'Écrivez librement, contrôlez la visibilité de chaque entrée et téléchargez vos données personnelles quand vous le souhaitez.',
    landingFeatureOrganizeTitle: 'Organisé par journaux',
    landingFeatureOrganizeBody:
      'Séparez les sujets par journal, réorganisez-les, marquez vos favoris et conservez une vue unifiée avec Tous les journaux.',
    landingFeatureExportTitle: 'Import et export portables',
    landingFeatureExportBody:
      'Passez du TXT au JSON ou au Markdown, préservez les métadonnées et gardez le nom du journal lors des exports Tous les journaux.',
    landingFeatureInsightTitle: 'Utile après l\'écriture',
    landingFeatureInsightBody:
      'Recherchez vite, filtrez par tags et visibilité, retrouvez les temps forts et observez vos tendances dans les statistiques.',
    suggestTags: 'Auto-Tags',
    suggestingTags: 'Tagging...',
    fixWriting: 'Reformuler',
    fixingWriting: 'Reformulation...',
    discussEntry: 'Discuter avec l\'IA',
    aiChat: 'Chat IA',
    aiThinking: 'Réflexion...',
    aiChatPlaceholder: 'Posez une question sur cette entrée...',
    aiChatError: 'Impossible d\'obtenir une réponse. Vérifiez votre clé API OpenRouter et réessayez.',

    // Authentication
    signIn: 'Se connecter',
    signUp: "S'inscrire",
    welcomeBack: 'Bon retour',
    createAccount: 'Créez votre compte',
    resetYourPassword: 'Réinitialiser votre mot de passe',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    username: "Nom d'utilisateur",
    emailOrUsername: "Email ou nom d'utilisateur",
    enterEmail: 'Entrez votre email',
    enterEmailOrUsername: "Entrez votre email ou nom d'utilisateur",
    enterPassword: 'Entrez votre mot de passe',
    enterUsername: "Choisissez un nom d'utilisateur",
    confirmPasswordPlaceholder: 'Confirmez votre mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    orContinueWith: 'ou continuer avec',
    continueWithGoogle: 'Continuer avec Google',
    dontHaveAccount: "Vous n'avez pas de compte ?",
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    emailPasswordRequired: "L'email et le mot de passe sont requis",
    identifierPasswordRequired: "L'email/nom d'utilisateur et le mot de passe sont requis",
    emailRequired: "L'email est requis",
    invalidEmail: 'Veuillez entrer une adresse email valide',
    passwordMinLength: 'Le mot de passe doit contenir au moins 6 caractères',
    passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
    authFailed: "Échec de l'authentification. Veuillez réessayer.",
    googleSignInFailed: 'Échec de la connexion Google. Veuillez réessayer.',
    forgotPassword: 'Mot de passe oublié ?',
    sendResetLink: 'Envoyer le lien de réinitialisation',
    backToLogin: 'Retour à la connexion',
    resetEmailSent:
      'Si un compte existe avec cet email, un lien de réinitialisation sera envoyé.',
    forgotPasswordFailed: "Échec de l'envoi de l'email de réinitialisation. Veuillez réessayer.",

    // Delete Account
    deleteAccount: 'Supprimer le compte',
    deleteAccountDescription: 'Supprimer définitivement votre compte et toutes les données associées',
    deleteAccountWarning:
      'Cette action est irréversible. Toutes vos données seront supprimées définitivement.',
    typeDeleteToConfirm: 'Tapez DELETE pour confirmer',
    enterYourPassword: 'Entrez votre mot de passe',
    confirmDelete: 'Confirmer la suppression',
    deleteAccountFailed: 'Échec de la suppression du compte. Veuillez réessayer.',
    passwordRequired: 'Le mot de passe est requis',

    // Entry Cross-References
    backToSource: "Retour à l'entrée source",
    entryNotFound: 'Entrée non trouvée',
    entryReferenceHint:
      'Astuce : Référencez d\'autres entrées en écrivant "entry (yyyy-mm-dd)" ou "entry (yyyy-mm-dd--X)" où X est l\'index de l\'entrée pour ce jour',

    // Diaries
    diaries: 'Journaux',
    manageDiaries: 'Gérer les journaux',
    newDiary: 'Nouveau journal',
    diaryName: 'Nom du journal',
    diaryIcon: 'Icône',
    diaryColor: 'Couleur',
    setAsDefault: 'Définir par défaut',
    defaultDiary: 'Journal par défaut',
    deleteDiary: 'Supprimer le journal',
    deleteDiaryWarning: 'Les entrées seront déplacées vers votre journal par défaut.',
    createDiary: 'Créer un journal',
    editDiary: 'Modifier le journal',
    allDiaries: 'Tous les journaux',
    noDiaries: 'Aucun journal trouvé. Créez-en un pour commencer !',
    visibilityOverrideHint: 'Peut être modifié par entrée',

    // Highlights / Thought of the Day
    highlightsTitle: 'À la une',
    randomThought: 'Pensée aléatoire',
    onThisDay: 'Ce jour-là',
    yearsAgo: 'Il y a {years} an(s)',
    refreshRandom: 'Obtenir une nouvelle pensée aléatoire',
    randomize: 'Aléatoire',
    highlightsError: 'Échec du chargement des mises en avant',
    tryAgain: 'Réessayer',
    expand: 'Développer',
    collapse: 'Réduire',
    seeHighlights: 'Voir les moments forts du jour',
    highlights: 'Moments forts',
    noHighlights:
      "Pas encore de moments forts. Commencez à écrire des entrées pour les voir ici !",

    // Text-to-Speech
    listen: 'Écouter',
    stopListening: "Arrêter l'écoute",
    listenThisEntry: 'Lire cette entrée',
    listenFromHere: 'Lire à partir d\'ici',
    readDates: 'Lire les dates à voix haute',
    readDatesDescription: 'Inclure les dates lors de la lecture des entrées',
    markdownEnabled: 'Markdown activé - cliquez pour passer au texte brut',
    markdownDisabled: 'Texte brut - cliquez pour activer le formatage Markdown',
    markdownToolbar: 'Barre d\'outils de formatage Markdown',
    loadingEntries: 'Chargement des entrées...',
    selectAll: 'Tout sélectionner',
    bulkModeEnter: 'Sélectionner',
    bulkModeExit: 'Annuler la sélection',
    bulkSelected: '{count} sélectionné(s)',
    bulkDelete: 'Supprimer',
    bulkMakePublic: 'Rendre public',
    bulkMakePrivate: 'Rendre privé',
    bulkAddTags: 'Ajouter des tags',
    bulkMove: 'Déplacer vers le journal',
    bulkClearSelection: 'Effacer',
    bulkDeleteTitle: 'Supprimer les entrées',
    bulkDeleteMessage: 'Êtes-vous sûr de vouloir supprimer {count} entrées ? Cette action est irréversible.',
    selectTags: 'Sélectionner des tags...',
    apply: 'Appliquer',
    attach: 'Joindre',
    attachFiles: 'Joindre des fichiers',
    attachments: 'Pièces jointes',
    removeAttachment: 'Supprimer la pièce jointe',
    attachmentTypeNotAllowed: "Ce type de fichier n'est pas autorisé. Autorisés : images, PDF, texte brut.",
    attachmentTooLarge: 'Le fichier est trop volumineux. Taille maximale : 5 Mo.',
    downloadAttachment: 'Télécharger la pièce jointe',
    closeImage: "Fermer l'image",
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    favorites: 'Favoris',
    filterFavorites: 'Afficher les favoris uniquement',
    dragToReorder: 'Glisser pour réorganiser',
    history: 'Historique',
    viewHistory: 'Voir l\'historique',
    noRevisions: 'Aucune version précédente',
    revision: 'Révision',
    restoredFrom: 'Restauré à partir de',
    aiConfiguration: 'Configuration IA',
    aiConfigDescription: 'Les fonctionnalités IA sont alimentées par OpenRouter. La clé API est configurée sur le serveur.',
    openRouterModel: 'Modèle',
    searchModels: 'Rechercher des modèles...',
    noModelsFound: 'Aucun modèle trouvé',
    loadingModels: 'Chargement des modèles...',
    autoTagMaxTags: 'Limite de tags automatiques',
    autoTagMaxTagsDescription: 'Définissez le nombre maximum de tags générés par l\'IA à ajouter lors de l\'enregistrement. Utilisez 0 pour désactiver l\'auto-tagging.',

    // Cloud Sync
    cloudSync: 'Synchronisation Cloud',
    cloudSyncDescription: 'Connectez-vous à Google Drive ou OneDrive pour synchroniser vos fichiers journal exportés vers le cloud.',
    cloudConnect: 'Connecter',
    cloudConnecting: 'Connexion...',
    cloudConnected: 'Connecté à {provider}',
    cloudConnectError: 'Échec de la connexion au fournisseur cloud',
    cloudDisconnect: 'Déconnecter',
    cloudDisconnected: 'Déconnecté de {provider}',
    cloudDisconnectError: 'Échec de la déconnexion',
    cloudStatusConnected: 'Connecté depuis le {date}',
    cloudStatusDisconnected: 'Non connecté',
    cloudUpload: 'Exporter vers le cloud',
    cloudUploading: 'Envoi en cours...',
    cloudUploadSuccess: '{name} envoyé avec succès',
    cloudUploadError: 'Échec de l\'envoi vers le cloud',
    cloudUploadOptions: 'Options d\'envoi',
    cloudDownload: 'Télécharger',
    cloudDownloadSuccess: '{name} téléchargé',
    cloudDownloadError: 'Échec du téléchargement depuis le cloud',
    cloudBrowseFiles: 'Parcourir les fichiers',
    cloudFilesInCloud: 'Fichiers dans {provider}',
    cloudNoFiles: 'Aucun fichier trouvé dans votre dossier cloud',
    // Cloud Sync Schedule
    cloudSchedule: 'Synchronisation programmée',
    cloudScheduleDescription: 'Synchronisez automatiquement votre journal vers le cloud selon un calendrier fixe. Seuls les changements depuis la dernière synchronisation sont détectés.',
    cloudScheduleFrequency: 'Fréquence',
    cloudScheduleEvery6h: 'Toutes les 6 heures',
    cloudScheduleEvery12h: 'Toutes les 12 heures',
    cloudScheduleDaily: 'Quotidien',
    cloudScheduleWeekly: 'Hebdomadaire',
    cloudScheduleEnable: 'Activer la programmation',
    cloudScheduleDisable: 'Désactiver la programmation',
    cloudScheduleEnabled: 'La synchronisation programmée est active',
    cloudScheduleDisabled: 'La synchronisation programmée est désactivée',
    cloudScheduleSaved: 'Programmation de synchronisation enregistrée',
    cloudScheduleSaveError: 'Échec de l\'enregistrement de la programmation',
    cloudScheduleRemoved: 'Programmation de synchronisation supprimée',
    cloudScheduleRemoveError: 'Échec de la suppression de la programmation',
    cloudSyncNow: 'Synchroniser maintenant',
    cloudSyncing: 'Synchronisation...',
    cloudSyncNoChanges: 'Aucun changement détecté depuis la dernière synchronisation',
    cloudSyncSuccess: '{name} synchronisé avec succès',
    cloudSyncError: 'Échec de la synchronisation',
    cloudLastSync: 'Dernière synchronisation : {date}',
    cloudNextSync: 'Prochaine synchronisation : {date}',
    cloudProviders: 'Fournisseurs Cloud',
    cloudProvidersDescription: 'Connectez vos comptes de stockage cloud pour activer la synchronisation et l\'importation de fichiers.',
    cloudImportFromCloud: 'Importer depuis le Cloud',
    cloudSelectFileToImport: 'Sélectionnez un fichier de votre stockage cloud à importer',
  },
};

export const getTranslation = (
  lang: string,
  key: string,
  params: TranslationParams = {}
): string => {
  const language = translations[lang as Language] || translations['en'];
  let text = language[key as TranslationKey] || key;

  Object.keys(params).forEach((param) => {
    text = text.replace(`{${param}}`, String(params[param]));
  });

  return text;
};

export type TranslationFunction = (
  key: string,
  params?: TranslationParams
) => string;
