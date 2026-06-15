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
  | 'about'
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
  | 'fontType'
  | 'fontTypeDescription'
  | 'fontTypeSystem'
  | 'fontTypeSerif'
  | 'fontTypeModern'
  | 'fontTypeMono'
  | 'fontSize'
  | 'fontSizeDescription'
  | 'fontColor'
  | 'fontColorDescription'
  | 'fontPreview'
  | 'fontPreviewDescription'
  | 'fontPreviewKicker'
  | 'fontPreviewSample'
  | 'ttsVoice'
  | 'ttsVoiceDescription'
  | 'ttsVoiceDefault'
  | 'ttsVoiceSystemLabel'
  | 'previewTtsVoice'
  | 'previewingTtsVoice'
  | 'ttsVoicePreviewSample'
  | 'entriesPerPage'
  | 'entriesPerPageDescription'
  | 'maxPinnedEntries'
  | 'maxPinnedEntriesDescription'
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
  | 'verifiedAccount'
  | 'unverifiedAccount'
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
  | 'entryWordCount'
  | 'entryReadingTimeMinutes'
  | 'entryReadingTimeLessThanMinute'
  | 'entryTemplate'
  | 'noEntryTemplate'
  | 'saveEntryTemplate'
  | 'deleteEntryTemplate'
  | 'templateNamePrompt'
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
  | 'avgWordsPerEntry'
  | 'avgReadingTime'
  | 'thoughtsPerYear'
  | 'thoughtsPerMonth'
  | 'topTagsByYear'
  | 'journalActivityByDay'
  | 'toneMoodInsights'
  | 'toneMoodInsightsDescription'
  | 'dominantMood'
  | 'dominantTone'
  | 'analyzedEntries'
  | 'moodMix'
  | 'toneMix'
  | 'toneMoodUnavailable'
  | 'lessActivity'
  | 'moreActivity'
  | 'noJournalActivity'
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
  | 'formatCsv'
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
  | 'book'
  | 'bookDescription'
  | 'bookTitleLabel'
  | 'bookTitlePlaceholder'
  | 'bookAuthorLabel'
  | 'bookAuthorPlaceholder'
  | 'bookFormatPdf'
  | 'bookFormatEpub'
  | 'bookFormatHtml'
  | 'bookChapterOrder'
  | 'chapterOrderAlpha'
  | 'chapterOrderEntries'
  | 'chapterOrderChrono'
  | 'bookTagScope'
  | 'tagScopeAll'
  | 'tagScopeFirst'
  | 'bookWeavingMode'
  | 'bookWeavingStrict'
  | 'bookWeavingCreative'
  | 'bookIncludeUntagged'
  | 'bookIncludeDates'
  | 'bookIncludeToc'
  | 'bookNarrative'
  | 'previewBook'
  | 'downloadBook'
  | 'generatingBook'
  | 'bookOutline'
  | 'bookChaptersCount'
  | 'bookEntriesCount'
  | 'bookNoChapters'
  | 'bookPreviewError'
  | 'bookExportSuccess'
  | 'bookExportError'
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
  | 'landingFeatureHeading'
  | 'landingFeaturePrivateTitle'
  | 'landingFeaturePrivateBody'
  | 'landingFeatureOrganizeTitle'
  | 'landingFeatureOrganizeBody'
  | 'landingFeatureExportTitle'
  | 'landingFeatureExportBody'
  | 'landingFeatureInsightTitle'
  | 'landingFeatureInsightBody'
  | 'landingProofPrivacyMetric'
  | 'landingProofPrivacyLabel'
  | 'landingProofExportMetric'
  | 'landingProofExportLabel'
  | 'landingProofInsightMetric'
  | 'landingProofInsightLabel'
  | 'landingScreenshotsKicker'
  | 'landingScreenshotsHeading'
  | 'landingScreenshotAlt'
  | 'landingSceneEntryTitle'
  | 'landingSceneEntryBody'
  | 'landingSceneStatsLabel'
  | 'landingScreenshotJournalTitle'
  | 'landingScreenshotJournalBody'
  | 'landingScreenshotStatsTitle'
  | 'landingScreenshotStatsBody'
  | 'landingScreenshotExportTitle'
  | 'landingScreenshotExportBody'
  | 'landingCtaKicker'
  | 'landingCtaTitle'
  | 'landingCtaBody'
  | 'aboutEyebrow'
  | 'aboutTitle'
  | 'aboutSubtitle'
  | 'aboutNoteLabel'
  | 'aboutNoteDate'
  | 'aboutNoteTitle'
  | 'aboutNoteBody'
  | 'aboutStoryKicker'
  | 'aboutStoryTitle'
  | 'aboutStoryBody'
  | 'aboutMissionKicker'
  | 'aboutMissionTitle'
  | 'aboutValuePrivacyTitle'
  | 'aboutValuePrivacyBody'
  | 'aboutValueOwnershipTitle'
  | 'aboutValueOwnershipBody'
  | 'aboutValueCalmTitle'
  | 'aboutValueCalmBody'
  | 'aboutTeamKicker'
  | 'aboutTeamTitle'
  | 'aboutTeamBody'
  | 'legalUpdatedLabel'
  | 'privacyTitle'
  | 'privacySubtitle'
  | 'privacyIntroTitle'
  | 'privacyIntroBody'
  | 'privacyDataTitle'
  | 'privacyDataBody'
  | 'privacyControlTitle'
  | 'privacyControlBody'
  | 'privacySecurityTitle'
  | 'privacySecurityBody'
  | 'termsTitle'
  | 'termsSubtitle'
  | 'termsUseTitle'
  | 'termsUseBody'
  | 'termsAccountTitle'
  | 'termsAccountBody'
  | 'termsContentTitle'
  | 'termsContentBody'
  | 'termsLimitsTitle'
  | 'termsLimitsBody'
  | 'contactEyebrow'
  | 'contactTitle'
  | 'contactSubtitle'
  | 'contactFormTitle'
  | 'contactNameLabel'
  | 'contactEmailLabel'
  | 'contactTopicLabel'
  | 'contactTopicSupport'
  | 'contactTopicAccount'
  | 'contactTopicBilling'
  | 'contactTopicPrivacy'
  | 'contactTopicFeedback'
  | 'contactMessageLabel'
  | 'contactSubmit'
  | 'contactSuccessTitle'
  | 'contactSuccessBody'
  | 'contactGuidesKicker'
  | 'contactGuidesTitle'
  | 'contactGuideStartTitle'
  | 'contactGuideStartBody'
  | 'contactGuideImportTitle'
  | 'contactGuideImportBody'
  | 'contactGuidePrivacyTitle'
  | 'contactGuidePrivacyBody'
  | 'contactFaqKicker'
  | 'contactFaqTitle'
  | 'contactFaqDataTitle'
  | 'contactFaqDataBody'
  | 'contactFaqAiTitle'
  | 'contactFaqAiBody'
  | 'contactFaqExportTitle'
  | 'contactFaqExportBody'
  | 'feedbackEyebrow'
  | 'feedbackTitle'
  | 'feedbackSubtitle'
  | 'feedbackFormTitle'
  | 'feedbackTitleLabel'
  | 'feedbackDetailsLabel'
  | 'feedbackSubmit'
  | 'feedbackSuccess'
  | 'feedbackBoardKicker'
  | 'feedbackBoardTitle'
  | 'feedbackStatusPlanned'
  | 'feedbackStatusReviewing'
  | 'feedbackStatusOpen'
  | 'feedbackIdeaOfflineTitle'
  | 'feedbackIdeaOfflineBody'
  | 'feedbackIdeaPromptsTitle'
  | 'feedbackIdeaPromptsBody'
  | 'feedbackIdeaSharingTitle'
  | 'feedbackIdeaSharingBody'
  | 'feedbackVote'
  | 'feedbackVoted'
  | 'feedbackVoteAria'
  | 'blogEyebrow'
  | 'blogTitle'
  | 'blogSubtitle'
  | 'blogIndexKicker'
  | 'blogIndexTitle'
  | 'blogCategoryUpdate'
  | 'blogCategoryTips'
  | 'blogCategoryInspiration'
  | 'blogUpdateTitle'
  | 'blogUpdateExcerpt'
  | 'blogUpdateBody'
  | 'blogUpdateDate'
  | 'blogTipsTitle'
  | 'blogTipsExcerpt'
  | 'blogTipsBody'
  | 'blogTipsDate'
  | 'blogInspirationTitle'
  | 'blogInspirationExcerpt'
  | 'blogInspirationBody'
  | 'blogInspirationDate'
  | 'blogRead'
  | 'blogReading'
  | 'suggestTags'
  | 'suggestingTags'
  | 'fixWriting'
  | 'fixingWriting'
  | 'discussEntry'
  | 'rephraseEntry'
  | 'rephrasingEntry'
  | 'rephraseGrammarOnly'
  | 'rephraseStyleLight'
  | 'rephraseCompleteRewrite'
  | 'aiChat'
  | 'aiThinking'
  | 'aiLoadingHistory'
  | 'aiChatPlaceholder'
  | 'aiChatError'
  | 'exportChatHistory'
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
  | 'backlinks'
  | 'backlinksCount'
  | 'loadingBacklinks'
  | 'noBacklinks'
  | 'entryNotFound'
  | 'entryNotFoundMessage'
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
  | 'bulkRephrase'
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
  | 'previewAttachment'
  | 'downloadAttachment'
  | 'closeImage'
  | 'favorite'
  | 'unfavorite'
  | 'pinEntry'
  | 'unpinEntry'
  | 'pinned'
  | 'pinnedEntries'
  | 'favorites'
  | 'filterFavorites'
  | 'archive'
  | 'unarchive'
  | 'archived'
  | 'activeEntries'
  | 'filterArchived'
  | 'bulkArchive'
  | 'bulkUnarchive'
  | 'entryPermalink'
  | 'shareEntry'
  | 'entryLinkCopied'
  | 'moreActions'
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
  | 'cloudSelectFileToImport'
  | 'subscriptionManagement'
  | 'subscriptionCurrentPlan'
  | 'subscriptionPlan'
  | 'subscriptionPlanDescription'
  | 'subscriptionPlanFree'
  | 'subscriptionPlanPlus'
  | 'subscriptionPlanPro'
  | 'subscriptionPrice'
  | 'subscriptionRenewal'
  | 'subscriptionMonthly'
  | 'subscriptionNoRenewal'
  | 'subscriptionPaymentMethod'
  | 'subscriptionPaymentMethodDescription'
  | 'subscriptionNoPaymentMethod'
  | 'billingHistory'
  | 'billingHistoryDescription'
  | 'billingDate'
  | 'billingDescription'
  | 'billingAmount'
  | 'billingStatus'
  | 'subscriptionPaid'
  | 'subscriptionIncluded'
  | 'subscriptionPreviousCycle';

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
    about: 'About',
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
    fontType: 'Font style',
    fontTypeDescription: 'Pick the typeface that feels easiest to read',
    fontTypeSystem: 'System UI',
    fontTypeSerif: 'Classic serif',
    fontTypeModern: 'Modern sans',
    fontTypeMono: 'Monospace',
    fontSize: 'Font size',
    fontSizeDescription: 'Adjust the base text size used across the app',
    fontColor: 'Font color',
    fontColorDescription: 'Set a preferred text color for your interface',
    fontPreview: 'Preview',
    fontPreviewDescription: 'Check how your chosen type, size, and color look together before saving.',
    fontPreviewKicker: 'Sample entry',
    fontPreviewSample: 'Quiet details become easier to notice when the page matches how you like to read and write.',
    ttsVoice: 'Voice for read aloud',
    ttsVoiceDescription: 'Choose which voice Thoughty uses when reading entries aloud.',
    ttsVoiceDefault: 'System default voice',
    ttsVoiceSystemLabel: 'system default',
    previewTtsVoice: 'Preview voice',
    previewingTtsVoice: 'Previewing...',
    ttsVoicePreviewSample: 'This is how your journal will sound when Thoughty reads it aloud.',
    entriesPerPage: 'Entries per page',
    entriesPerPageDescription: 'Number of entries to display per page',
    maxPinnedEntries: 'Pinned entries limit',
    maxPinnedEntriesDescription: 'Maximum entries that can stay pinned at the top of the journal',
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
    verifiedAccount: 'Verified',
    unverifiedAccount: 'Email not verified',
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
    entryWordCount: '{count} words',
    entryReadingTimeMinutes: '{minutes} min read',
    entryReadingTimeLessThanMinute: '<1 min read',
    entryTemplate: 'Entry template',
    noEntryTemplate: 'Choose a template',
    saveEntryTemplate: 'Save template',
    deleteEntryTemplate: 'Delete template',
    templateNamePrompt: 'Template name',

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
    avgWordsPerEntry: 'Avg. Words',
    avgReadingTime: 'Avg. Read Time',
    thoughtsPerYear: 'Entries per Year',
    thoughtsPerMonth: 'Entries per Month',
    topTagsByYear: 'Top Tags by Year',
    journalActivityByDay: 'Journal Activity by Day',
    toneMoodInsights: 'Tone and Mood',
    toneMoodInsightsDescription: 'AI analysis of your recent writing patterns.',
    dominantMood: 'Dominant Mood',
    dominantTone: 'Dominant Tone',
    analyzedEntries: 'Analyzed entries',
    moodMix: 'Mood Mix',
    toneMix: 'Tone Mix',
    toneMoodUnavailable: 'AI analysis is unavailable right now. Configure AI settings and try again later.',
    lessActivity: 'Less',
    moreActivity: 'More',
    noJournalActivity: 'No journaling activity yet.',

    // Import/Export
    importExport: 'Import/Export',
    import: 'Import',
    export: 'Export',
    exportDescription: 'Download all journal entries from {diaryName} in the format of your choice.',
    importDescription: 'Upload a text file to import entries into {diaryName}.',
    downloadExport: 'Download',
    includeVisibility: 'Include visibility (public/private) in export',
    includeVisibilityShort: 'Include visibility',
    exportFormat: 'Format',
    formatTxt: 'Text (.txt)',
    formatJson: 'JSON (.json)',
    formatMd: 'Markdown (.md)',
    formatCsv: 'CSV (.csv)',
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

    // Book converter
    book: 'Book',
    bookDescription:
      'Turn the entries of {diaryName} into a book: each tag becomes a chapter, and AI weaves its thoughts into flowing prose without adding anything that is not yours.',
    bookTitleLabel: 'Title',
    bookTitlePlaceholder: 'Defaults to the diary name',
    bookAuthorLabel: 'Author',
    bookAuthorPlaceholder: 'Defaults to your username',
    bookFormatPdf: 'PDF (.pdf)',
    bookFormatEpub: 'EPUB (.epub)',
    bookFormatHtml: 'HTML (.html)',
    bookChapterOrder: 'Chapter order',
    chapterOrderAlpha: 'Alphabetical',
    chapterOrderEntries: 'Most entries first',
    chapterOrderChrono: 'By first entry date',
    bookTagScope: 'Entries with several tags',
    tagScopeAll: 'Appear in every tag chapter',
    tagScopeFirst: 'Appear in their first tag chapter only',
    bookWeavingMode: 'AI weaving mode',
    bookWeavingStrict: 'Strict to entries',
    bookWeavingCreative: 'Creative transitions',
    bookIncludeUntagged: 'Add a chapter for untagged entries',
    bookIncludeDates: 'Show entry dates',
    bookIncludeToc: 'Include table of contents',
    bookNarrative: 'Weave thoughts into flowing prose with AI',
    previewBook: 'Preview Chapters',
    downloadBook: 'Download Book',
    generatingBook: 'Generating...',
    bookOutline: 'Book Outline',
    bookChaptersCount: 'chapters',
    bookEntriesCount: 'entries',
    bookNoChapters: 'No chapters could be built. Add tags to your entries to create chapters.',
    bookPreviewError: 'Failed to preview book',
    bookExportSuccess: 'Book downloaded successfully',
    bookExportError: 'Failed to generate book',
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
    landingFeatureHeading: 'Capture the day, then keep finding what matters.',
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
    landingProofPrivacyMetric: 'Private first',
    landingProofPrivacyLabel: 'Every entry starts under your control',
    landingProofExportMetric: '7 export formats',
    landingProofExportLabel: 'TXT, JSON, Markdown, CSV, PDF, EPUB, and HTML',
    landingProofInsightMetric: 'Diary-aware',
    landingProofInsightLabel: 'Structure, stats, imports, and exports respect each journal',
    landingScreenshotsKicker: 'Product screenshots',
    landingScreenshotsHeading: 'The main workflows are visible before you sign up.',
    landingScreenshotAlt: 'Thoughty journal interface preview',
    landingSceneEntryTitle: 'Morning planning',
    landingSceneEntryBody: 'Two decisions to remember, one question to revisit, and a cleaner way to end the week.',
    landingSceneStatsLabel: 'Average words',
    landingScreenshotJournalTitle: 'A focused journal surface',
    landingScreenshotJournalBody:
      'Entries support tags, visibility, attachments, references, templates, pinned notes, and rich Markdown when you need it.',
    landingScreenshotStatsTitle: 'Stats that stay close to the writing',
    landingScreenshotStatsBody:
      'Activity, tag trends, word counts, reading time, and tone analysis help you review without turning reflection into reporting.',
    landingScreenshotExportTitle: 'Import/export that respects ownership',
    landingScreenshotExportBody:
      'Preview imports, skip duplicates, export by diary, and keep portable formats ready for spreadsheets, books, or backups.',
    landingCtaKicker: 'Start quietly',
    landingCtaTitle: 'Open a journal you can keep using years from now.',
    landingCtaBody:
      'Create an account, write privately by default, and export your work whenever you want to leave with everything intact.',
    aboutEyebrow: 'About Thoughty',
    aboutTitle: 'A quieter home for the thoughts worth keeping.',
    aboutSubtitle:
      'Thoughty exists for people who want reflection to stay personal, searchable, and portable without becoming another noisy productivity system.',
    aboutNoteLabel: 'A sample Thoughty note',
    aboutNoteDate: 'Mission note',
    aboutNoteTitle: 'Useful journaling should respect the writer.',
    aboutNoteBody:
      'The product is shaped around private defaults, clear ownership, and tools that help after the writing without getting in the way during it.',
    aboutStoryKicker: 'The story',
    aboutStoryTitle: 'Built from the need to keep a life searchable.',
    aboutStoryBody:
      'Thoughty began as a practical journal: a place to write plainly, split life into diaries, import old notes, export everything, and find ideas again months later. The app keeps that origin close by treating portability and calm organization as core features, not add-ons.',
    aboutMissionKicker: 'Mission',
    aboutMissionTitle: 'Make personal writing easier to keep, revisit, and trust.',
    aboutValuePrivacyTitle: 'Privacy first',
    aboutValuePrivacyBody:
      'Entries are private by default, visibility is explicit, and personal data remains downloadable.',
    aboutValueOwnershipTitle: 'Ownership always',
    aboutValueOwnershipBody:
      'Import and export paths keep journals useful outside the app, from backups to books.',
    aboutValueCalmTitle: 'Calm utility',
    aboutValueCalmBody:
      'Thoughty favors focused workflows, reusable organization, and AI only where it helps reflection.',
    aboutTeamKicker: 'Team',
    aboutTeamTitle: 'Small, product-led, and close to the writing.',
    aboutTeamBody:
      'Thoughty is developed as a focused independent product with a simple standard: every new feature should make the journal more trustworthy, more useful, or easier to leave with your work intact.',
    legalUpdatedLabel: 'Last updated June 2026',
    privacyTitle: 'Privacy Policy',
    privacySubtitle:
      'Thoughty is built for private journaling. This policy explains what the app needs to run and how your data stays under your control.',
    privacyIntroTitle: 'Private by design',
    privacyIntroBody:
      'Journal entries are private by default. Public visibility is an explicit entry-level choice, and your account settings keep privacy controls close to the writing workflow.',
    privacyDataTitle: 'Data we use',
    privacyDataBody:
      'Thoughty stores account details, profile settings, diaries, entries, tags, attachments, sync preferences, and subscription records needed to provide the service.',
    privacyControlTitle: 'Your controls',
    privacyControlBody:
      'You can edit or delete entries, download your user data, export journals in portable formats, change visibility, and delete your account from the app.',
    privacySecurityTitle: 'Security and providers',
    privacySecurityBody:
      'Authentication, cloud sync, storage, payments, and AI features may rely on configured providers. Thoughty keeps those integrations limited to the feature you choose to use.',
    termsTitle: 'Terms of Service',
    termsSubtitle:
      'These terms set the basic expectations for using Thoughty respectfully, keeping your account secure, and retaining ownership of your writing.',
    termsUseTitle: 'Using Thoughty',
    termsUseBody:
      'Use Thoughty for lawful personal writing, organization, import, export, and reflection. Do not abuse public features, interfere with the service, or try to access another account.',
    termsAccountTitle: 'Account responsibility',
    termsAccountBody:
      'You are responsible for keeping your login credentials secure and for the activity that happens through your account.',
    termsContentTitle: 'Your content',
    termsContentBody:
      'You keep ownership of your entries, attachments, exports, and profile content. Thoughty processes that content only to operate the features you use.',
    termsLimitsTitle: 'Service changes',
    termsLimitsBody:
      'Features, limits, and subscription plans may change as the product evolves. Important user-facing changes should be reflected in the app and supporting documentation.',
    contactEyebrow: 'Support',
    contactTitle: 'Contact and support',
    contactSubtitle:
      'Send a question, report an account issue, or start with the most common guides for keeping your journal organized and portable.',
    contactFormTitle: 'Send a message',
    contactNameLabel: 'Name',
    contactEmailLabel: 'Email',
    contactTopicLabel: 'Topic',
    contactTopicSupport: 'Product support',
    contactTopicAccount: 'Account access',
    contactTopicBilling: 'Billing',
    contactTopicPrivacy: 'Privacy and data',
    contactTopicFeedback: 'Feedback or feature idea',
    contactMessageLabel: 'Message',
    contactSubmit: 'Send message',
    contactSuccessTitle: 'Message ready',
    contactSuccessBody:
      'Thanks for reaching out. Your message has been captured in this session and the support team can wire it to an inbox next.',
    contactGuidesKicker: 'How to',
    contactGuidesTitle: 'How to guides',
    contactGuideStartTitle: 'Start a focused journal',
    contactGuideStartBody:
      'Create entries with dates, tags, templates, and privacy settings so each thought stays easy to find later.',
    contactGuideImportTitle: 'Import existing notes',
    contactGuideImportBody:
      'Use the import preview to detect formats, skip duplicates, and place old journals into the right diary before saving.',
    contactGuidePrivacyTitle: 'Manage privacy',
    contactGuidePrivacyBody:
      'Keep entries private by default, make public thoughts explicit, and download or delete your data from Profile.',
    contactFaqKicker: 'FAQ',
    contactFaqTitle: 'Frequently asked questions',
    contactFaqDataTitle: 'Can I export everything?',
    contactFaqDataBody:
      'Yes. Thoughty supports journal exports, stats exports, and a full user-data download from Profile.',
    contactFaqAiTitle: 'Does AI read my whole journal?',
    contactFaqAiBody:
      'AI actions are tied to the feature you choose, such as tag suggestions, rephrasing, chat, or tone analysis.',
    contactFaqExportTitle: 'Which formats are available?',
    contactFaqExportBody:
      'Entries can move through TXT, JSON, Markdown, CSV, PDF, EPUB, and HTML depending on the export workflow.',
    feedbackEyebrow: 'Feedback',
    feedbackTitle: 'Shape what Thoughty becomes next.',
    feedbackSubtitle:
      'Share feature ideas, describe the problem behind them, and upvote requests that would make your journal more useful.',
    feedbackFormTitle: 'Submit an idea',
    feedbackTitleLabel: 'Idea title',
    feedbackDetailsLabel: 'What would this improve?',
    feedbackSubmit: 'Post idea',
    feedbackSuccess: 'Your idea has been added to the board for this session.',
    feedbackBoardKicker: 'Feature requests',
    feedbackBoardTitle: 'Ideas from the community',
    feedbackStatusPlanned: 'Planned',
    feedbackStatusReviewing: 'Reviewing',
    feedbackStatusOpen: 'Open',
    feedbackIdeaOfflineTitle: 'Offline writing mode',
    feedbackIdeaOfflineBody:
      'Let the journal stay usable without a connection, then sync safely when the device comes back online.',
    feedbackIdeaPromptsTitle: 'Personalized writing prompts',
    feedbackIdeaPromptsBody:
      'Suggest prompts from diary history, tags, and recurring themes without forcing a rigid habit tracker.',
    feedbackIdeaSharingTitle: 'Shared public collections',
    feedbackIdeaSharingBody:
      'Group selected public thoughts into a curated collection that can be shared with a small audience.',
    feedbackVote: 'Vote',
    feedbackVoted: 'Voted',
    feedbackVoteAria: 'Vote for {title}',
    blogEyebrow: 'Thoughty blog',
    blogTitle: 'Updates, tips, and journaling inspiration.',
    blogSubtitle:
      'Read product notes, practical writing workflows, and prompts that help Thoughty stay useful after the first week.',
    blogIndexKicker: 'Latest posts',
    blogIndexTitle: 'From the journal desk',
    blogCategoryUpdate: 'Product update',
    blogCategoryTips: 'Journaling tips',
    blogCategoryInspiration: 'Inspiration',
    blogUpdateTitle: 'What changed in Thoughty this month',
    blogUpdateExcerpt:
      'A quick look at public pages, cleaner navigation, and the support surfaces that make the app easier to trust.',
    blogUpdateBody:
      'This month focuses on the public side of Thoughty: clearer About, Privacy, Terms, Contact, Feedback, and Blog pages so people can understand the product before creating an account.',
    blogUpdateDate: 'June 2026',
    blogTipsTitle: 'A simple weekly review that stays light',
    blogTipsExcerpt:
      'Use tags, favorites, and stats to review a week of writing without turning your journal into a reporting chore.',
    blogTipsBody:
      'Pick three entries from the week: one useful decision, one open question, and one moment worth remembering. Favorite them, tag the theme, then let stats show patterns only after the writing is done.',
    blogTipsDate: 'Guide',
    blogInspirationTitle: 'Prompts for writing when the day feels noisy',
    blogInspirationExcerpt:
      'Three quiet prompts for getting thoughts out without forcing a perfect entry or a polished conclusion.',
    blogInspirationBody:
      'Try starting with what still has your attention, what can wait until tomorrow, and what you want future-you to remember. A useful entry can be short, unfinished, and still worth keeping.',
    blogInspirationDate: 'Prompt set',
    blogRead: 'Read',
    blogReading: 'Reading',
    suggestTags: 'Auto-Tags',
    suggestingTags: 'Tagging...',
    fixWriting: 'Rephrase',
    fixingWriting: 'Rephrasing...',
    discussEntry: 'Discuss with AI',
    rephraseEntry: 'Rephrase entry',
    rephrasingEntry: 'Rephrasing entry...',
    rephraseGrammarOnly: 'Grammar/form only',
    rephraseStyleLight: 'Slight style improvements',
    rephraseCompleteRewrite: 'Complete rewrite',
    aiChat: 'AI Chat',
    aiThinking: 'Thinking...',
    aiLoadingHistory: 'Loading chat history...',
    aiChatPlaceholder: 'Ask something about this entry...',
    aiChatError: 'Unable to get a response. Check your OpenRouter API key and try again.',
    exportChatHistory: 'Export Chat',

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
    backlinks: 'Backlinks',
    backlinksCount: '{count} links',
    loadingBacklinks: 'Loading backlinks...',
    noBacklinks: 'No backlinks yet',
    entryNotFound: 'Entry not found',
    entryNotFoundMessage: 'This entry may have been deleted, or the link is no longer valid.',
    entryReferenceHint:
      'Tip: Reference other entries by writing "[[yyyy-mm-dd]]" or "[[yyyy-mm-dd#X]]" where X is the index of the entry for that day',

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
    bulkRephrase: 'Rephrase',
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
    attachmentTypeNotAllowed: 'This file type is not allowed. Allowed: images, audio, PDF, plain text.',
    attachmentTooLarge: 'File is too large. Maximum size is 5 MB.',
    previewAttachment: 'Preview',
    downloadAttachment: 'Download attachment',
    closeImage: 'Close image',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    pinEntry: 'Pin entry',
    unpinEntry: 'Unpin entry',
    pinned: 'Pinned',
    pinnedEntries: 'Pinned entries',
    favorites: 'Favorites',
    filterFavorites: 'Show favorites only',
    archive: 'Archive entry',
    unarchive: 'Restore entry',
    archived: 'Archived',
    activeEntries: 'Active',
    filterArchived: 'Filter archived entries',
    bulkArchive: 'Archive',
    bulkUnarchive: 'Unarchive',
    entryPermalink: 'Open entry permalink',
    shareEntry: 'Share entry',
    entryLinkCopied: 'Entry link copied',
    moreActions: 'More actions',
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
    subscriptionManagement: 'Subscription',
    subscriptionCurrentPlan: 'Current plan',
    subscriptionPlan: 'Plan',
    subscriptionPlanDescription: 'Choose the subscription tier saved for this account',
    subscriptionPlanFree: 'Free',
    subscriptionPlanPlus: 'Plus',
    subscriptionPlanPro: 'Pro',
    subscriptionPrice: 'Price',
    subscriptionRenewal: 'Renewal',
    subscriptionMonthly: 'Monthly',
    subscriptionNoRenewal: 'No renewal',
    subscriptionPaymentMethod: 'Payment method',
    subscriptionPaymentMethodDescription: 'Store the payment method label shown in billing records',
    subscriptionNoPaymentMethod: 'No payment method',
    billingHistory: 'Billing history',
    billingHistoryDescription: 'Recent account billing records',
    billingDate: 'Date',
    billingDescription: 'Description',
    billingAmount: 'Amount',
    billingStatus: 'Status',
    subscriptionPaid: 'Paid',
    subscriptionIncluded: 'Included',
    subscriptionPreviousCycle: 'Previous billing cycle',
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
    about: 'À propos',
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
    fontType: 'Style de police',
    fontTypeDescription: 'Choisissez la police la plus confortable à lire',
    fontTypeSystem: 'Interface système',
    fontTypeSerif: 'Serif classique',
    fontTypeModern: 'Sans moderne',
    fontTypeMono: 'Monospace',
    fontSize: 'Taille du texte',
    fontSizeDescription: 'Ajustez la taille de texte de base utilisée dans l’application',
    fontColor: 'Couleur du texte',
    fontColorDescription: 'Définissez une couleur de texte préférée pour votre interface',
    fontPreview: 'Aperçu',
    fontPreviewDescription: 'Vérifiez l’ensemble police, taille et couleur avant d’enregistrer.',
    fontPreviewKicker: 'Exemple de note',
    fontPreviewSample: 'Les détails calmes deviennent plus faciles à voir quand la page correspond à votre façon de lire et d’écrire.',
    ttsVoice: 'Voix de lecture',
    ttsVoiceDescription: 'Choisissez la voix que Thoughty utilise pour lire les entrées à voix haute.',
    ttsVoiceDefault: 'Voix système par défaut',
    ttsVoiceSystemLabel: 'par défaut',
    previewTtsVoice: 'Écouter un aperçu',
    previewingTtsVoice: 'Lecture...',
    ttsVoicePreviewSample: 'Voici comment votre journal sonnera lorsque Thoughty le lira à voix haute.',
    entriesPerPage: 'Entrées par page',
    entriesPerPageDescription: "Nombre d'entrées à afficher par page",
    maxPinnedEntries: 'Limite des entrées épinglées',
    maxPinnedEntriesDescription: "Nombre maximum d'entrées qui peuvent rester épinglées en haut du journal",
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
    verifiedAccount: 'Vérifié',
    unverifiedAccount: 'Email non vérifié',
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
    entryWordCount: '{count} mots',
    entryReadingTimeMinutes: '{minutes} min de lecture',
    entryReadingTimeLessThanMinute: '<1 min de lecture',
    entryTemplate: "Modèle d'entrée",
    noEntryTemplate: 'Choisir un modèle',
    saveEntryTemplate: 'Enregistrer le modèle',
    deleteEntryTemplate: 'Supprimer le modèle',
    templateNamePrompt: 'Nom du modèle',

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
    avgWordsPerEntry: 'Moy. mots',
    avgReadingTime: 'Moy. lecture',
    thoughtsPerYear: 'Entrées par an',
    thoughtsPerMonth: 'Entrées par mois',
    topTagsByYear: 'Top tags par année',
    journalActivityByDay: 'Activité du journal par jour',
    toneMoodInsights: 'Ton et humeur',
    toneMoodInsightsDescription: 'Analyse IA de vos tendances d\'écriture récentes.',
    dominantMood: 'Humeur dominante',
    dominantTone: 'Ton dominant',
    analyzedEntries: 'Entrées analysées',
    moodMix: 'Répartition des humeurs',
    toneMix: 'Répartition des tons',
    toneMoodUnavailable: 'L\'analyse IA est indisponible pour le moment. Configurez l\'IA puis réessayez plus tard.',
    lessActivity: 'Moins',
    moreActivity: 'Plus',
    noJournalActivity: 'Aucune activité de journal pour le moment.',

    // Import/Export
    importExport: 'Import/Export',
    import: 'Importer',
    export: 'Exporter',
    exportDescription:
      'Téléchargez toutes les entrées de {diaryName} au format de votre choix.',
    importDescription: 'Téléversez un fichier texte pour importer des entrées dans {diaryName}.',
    downloadExport: 'Télécharger',
    includeVisibility: 'Inclure la visibilité (public/privé) dans l\'export',
    includeVisibilityShort: 'Inclure la visibilité',
    exportFormat: 'Format',
    formatTxt: 'Texte (.txt)',
    formatJson: 'JSON (.json)',
    formatMd: 'Markdown (.md)',
    formatCsv: 'CSV (.csv)',
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

    // Book converter
    book: 'Livre',
    bookDescription:
      "Transformez les entrées de {diaryName} en livre : chaque tag devient un chapitre, et l'IA tisse ses pensées en prose fluide sans rien ajouter qui ne vienne de vous.",
    bookTitleLabel: 'Titre',
    bookTitlePlaceholder: 'Par défaut : le nom du journal',
    bookAuthorLabel: 'Auteur',
    bookAuthorPlaceholder: "Par défaut : votre nom d'utilisateur",
    bookFormatPdf: 'PDF (.pdf)',
    bookFormatEpub: 'EPUB (.epub)',
    bookFormatHtml: 'HTML (.html)',
    bookChapterOrder: 'Ordre des chapitres',
    chapterOrderAlpha: 'Alphabétique',
    chapterOrderEntries: "Par nombre d'entrées",
    chapterOrderChrono: 'Par date de première entrée',
    bookTagScope: 'Entrées avec plusieurs tags',
    tagScopeAll: 'Apparaissent dans chaque chapitre de tag',
    tagScopeFirst: 'Apparaissent uniquement dans leur premier chapitre',
    bookWeavingMode: "Mode de tissage IA",
    bookWeavingStrict: 'Strictement fidèle aux entrées',
    bookWeavingCreative: 'Transitions créatives',
    bookIncludeUntagged: 'Ajouter un chapitre pour les entrées sans tag',
    bookIncludeDates: 'Afficher les dates des entrées',
    bookIncludeToc: 'Inclure la table des matières',
    bookNarrative: "Tisser les pensées en prose fluide avec l'IA",
    previewBook: 'Aperçu des chapitres',
    downloadBook: 'Télécharger le livre',
    generatingBook: 'Génération...',
    bookOutline: 'Plan du livre',
    bookChaptersCount: 'chapitres',
    bookEntriesCount: 'entrées',
    bookNoChapters: 'Aucun chapitre n\'a pu être créé. Ajoutez des tags à vos entrées pour créer des chapitres.',
    bookPreviewError: "Échec de l'aperçu du livre",
    bookExportSuccess: 'Livre téléchargé avec succès',
    bookExportError: 'Échec de la génération du livre',
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
    landingFeatureHeading: 'Notez la journée, puis retrouvez ce qui compte.',
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
    landingProofPrivacyMetric: 'Privé d\'abord',
    landingProofPrivacyLabel: 'Chaque entrée reste sous votre contrôle',
    landingProofExportMetric: '7 formats d\'export',
    landingProofExportLabel: 'TXT, JSON, Markdown, CSV, PDF, EPUB et HTML',
    landingProofInsightMetric: 'Par journal',
    landingProofInsightLabel: 'Structure, stats, imports et exports respectent chaque journal',
    landingScreenshotsKicker: 'Aperçus du produit',
    landingScreenshotsHeading: 'Les principaux usages sont visibles avant l\'inscription.',
    landingScreenshotAlt: 'Aperçu de l\'interface du journal Thoughty',
    landingSceneEntryTitle: 'Plan du matin',
    landingSceneEntryBody: 'Deux décisions à garder, une question à reprendre, et une meilleure façon de finir la semaine.',
    landingSceneStatsLabel: 'Moyenne de mots',
    landingScreenshotJournalTitle: 'Une surface d\'écriture concentrée',
    landingScreenshotJournalBody:
      'Les entrées prennent en charge tags, visibilité, pièces jointes, références, modèles, notes épinglées et Markdown riche.',
    landingScreenshotStatsTitle: 'Des stats proches de l\'écriture',
    landingScreenshotStatsBody:
      'Activité, tendances par tag, mots, temps de lecture et analyse de ton aident à relire sans transformer la réflexion en rapport.',
    landingScreenshotExportTitle: 'Import/export fidèle à vos données',
    landingScreenshotExportBody:
      'Prévisualisez les imports, ignorez les doublons, exportez par journal et gardez des formats prêts pour tableurs, livres ou sauvegardes.',
    landingCtaKicker: 'Commencer calmement',
    landingCtaTitle: 'Ouvrez un journal que vous pourrez garder pendant des années.',
    landingCtaBody:
      'Créez un compte, écrivez en privé par défaut et exportez votre travail quand vous voulez repartir avec tout intact.',
    aboutEyebrow: 'À propos de Thoughty',
    aboutTitle: 'Un lieu plus calme pour les pensées qui méritent de rester.',
    aboutSubtitle:
      'Thoughty s’adresse aux personnes qui veulent une réflexion personnelle, retrouvable et portable sans ajouter un système de productivité bruyant.',
    aboutNoteLabel: 'Exemple de note Thoughty',
    aboutNoteDate: 'Note de mission',
    aboutNoteTitle: 'Un bon journal respecte la personne qui écrit.',
    aboutNoteBody:
      'Le produit est construit autour du privé par défaut, de la propriété claire des données et d’outils utiles après l’écriture, sans gêner le moment d’écrire.',
    aboutStoryKicker: 'L’histoire',
    aboutStoryTitle: 'Né du besoin de garder une vie retrouvable.',
    aboutStoryBody:
      'Thoughty a commencé comme un journal pratique : écrire simplement, séparer les sujets par journaux, importer d’anciennes notes, tout exporter et retrouver des idées plusieurs mois plus tard. L’application garde cette origine en traitant la portabilité et l’organisation calme comme des bases, pas comme des options.',
    aboutMissionKicker: 'Mission',
    aboutMissionTitle: 'Rendre l’écriture personnelle plus facile à garder, relire et faire confiance.',
    aboutValuePrivacyTitle: 'Confidentialité d’abord',
    aboutValuePrivacyBody:
      'Les entrées sont privées par défaut, la visibilité est explicite et les données personnelles restent téléchargeables.',
    aboutValueOwnershipTitle: 'Propriété toujours',
    aboutValueOwnershipBody:
      'Les imports et exports gardent les journaux utiles hors de l’application, des sauvegardes aux livres.',
    aboutValueCalmTitle: 'Utilité calme',
    aboutValueCalmBody:
      'Thoughty privilégie les usages concentrés, l’organisation réutilisable et l’IA seulement quand elle aide la réflexion.',
    aboutTeamKicker: 'Équipe',
    aboutTeamTitle: 'Petite, orientée produit, proche de l’écriture.',
    aboutTeamBody:
      'Thoughty est développé comme un produit indépendant et ciblé avec une règle simple : chaque nouveauté doit rendre le journal plus fiable, plus utile ou plus facile à quitter avec votre travail intact.',
    legalUpdatedLabel: 'Dernière mise à jour juin 2026',
    privacyTitle: 'Politique de confidentialité',
    privacySubtitle:
      'Thoughty est conçu pour un journal privé. Cette politique explique ce dont l’application a besoin pour fonctionner et comment vos données restent sous votre contrôle.',
    privacyIntroTitle: 'Privé par conception',
    privacyIntroBody:
      'Les entrées du journal sont privées par défaut. La visibilité publique est un choix explicite pour chaque entrée, et les réglages de confidentialité restent proches de l’écriture.',
    privacyDataTitle: 'Données utilisées',
    privacyDataBody:
      'Thoughty stocke les informations de compte, réglages de profil, journaux, entrées, tags, pièces jointes, préférences de synchronisation et éléments d’abonnement nécessaires au service.',
    privacyControlTitle: 'Vos contrôles',
    privacyControlBody:
      'Vous pouvez modifier ou supprimer des entrées, télécharger vos données, exporter vos journaux dans des formats portables, changer la visibilité et supprimer votre compte.',
    privacySecurityTitle: 'Sécurité et fournisseurs',
    privacySecurityBody:
      'L’authentification, la synchronisation cloud, le stockage, les paiements et les fonctions IA peuvent utiliser des fournisseurs configurés. Thoughty limite ces intégrations à la fonction choisie.',
    termsTitle: "Conditions d'utilisation",
    termsSubtitle:
      'Ces conditions posent les attentes de base pour utiliser Thoughty avec respect, sécuriser votre compte et conserver la propriété de vos écrits.',
    termsUseTitle: 'Utiliser Thoughty',
    termsUseBody:
      'Utilisez Thoughty pour une écriture personnelle licite, l’organisation, l’import, l’export et la réflexion. N’abusez pas des fonctions publiques, ne perturbez pas le service et ne tentez pas d’accéder à un autre compte.',
    termsAccountTitle: 'Responsabilité du compte',
    termsAccountBody:
      'Vous êtes responsable de la sécurité de vos identifiants et de l’activité réalisée depuis votre compte.',
    termsContentTitle: 'Votre contenu',
    termsContentBody:
      'Vous conservez la propriété de vos entrées, pièces jointes, exports et contenus de profil. Thoughty traite ce contenu uniquement pour faire fonctionner les fonctions utilisées.',
    termsLimitsTitle: 'Évolution du service',
    termsLimitsBody:
      'Les fonctionnalités, limites et abonnements peuvent évoluer avec le produit. Les changements importants pour les utilisateurs doivent apparaître dans l’application et la documentation.',
    contactEyebrow: 'Support',
    contactTitle: 'Contact et support',
    contactSubtitle:
      'Envoyez une question, signalez un problème de compte ou commencez avec les guides les plus courants pour garder votre journal organisé et portable.',
    contactFormTitle: 'Envoyer un message',
    contactNameLabel: 'Nom',
    contactEmailLabel: 'Email',
    contactTopicLabel: 'Sujet',
    contactTopicSupport: 'Support produit',
    contactTopicAccount: 'Accès au compte',
    contactTopicBilling: 'Facturation',
    contactTopicPrivacy: 'Confidentialité et données',
    contactTopicFeedback: 'Avis ou idée de fonctionnalité',
    contactMessageLabel: 'Message',
    contactSubmit: 'Envoyer le message',
    contactSuccessTitle: 'Message prêt',
    contactSuccessBody:
      'Merci pour votre message. Il a été capturé dans cette session et l’équipe support pourra ensuite le relier à une boîte de réception.',
    contactGuidesKicker: 'Guides',
    contactGuidesTitle: 'Guides pratiques',
    contactGuideStartTitle: 'Commencer un journal ciblé',
    contactGuideStartBody:
      'Créez des entrées avec dates, tags, modèles et confidentialité pour retrouver facilement chaque pensée plus tard.',
    contactGuideImportTitle: 'Importer des notes existantes',
    contactGuideImportBody:
      'Utilisez l’aperçu d’import pour détecter les formats, éviter les doublons et placer les anciens journaux au bon endroit.',
    contactGuidePrivacyTitle: 'Gérer la confidentialité',
    contactGuidePrivacyBody:
      'Gardez les entrées privées par défaut, rendez les pensées publiques explicitement, puis téléchargez ou supprimez vos données depuis le profil.',
    contactFaqKicker: 'FAQ',
    contactFaqTitle: 'Questions fréquentes',
    contactFaqDataTitle: 'Puis-je tout exporter ?',
    contactFaqDataBody:
      'Oui. Thoughty prend en charge les exports de journal, les exports de statistiques et le téléchargement complet des données utilisateur depuis le profil.',
    contactFaqAiTitle: 'L’IA lit-elle tout mon journal ?',
    contactFaqAiBody:
      'Les actions IA sont liées à la fonction choisie, comme les suggestions de tags, la reformulation, le chat ou l’analyse de ton.',
    contactFaqExportTitle: 'Quels formats sont disponibles ?',
    contactFaqExportBody:
      'Les entrées peuvent passer par TXT, JSON, Markdown, CSV, PDF, EPUB et HTML selon le parcours d’export.',
    feedbackEyebrow: 'Feedback',
    feedbackTitle: 'Aidez Thoughty à évoluer.',
    feedbackSubtitle:
      'Partagez vos idées, décrivez le problème à résoudre et votez pour les demandes qui rendraient votre journal plus utile.',
    feedbackFormTitle: 'Proposer une idée',
    feedbackTitleLabel: 'Titre de l’idée',
    feedbackDetailsLabel: 'Qu’est-ce que cela améliorerait ?',
    feedbackSubmit: 'Publier l’idée',
    feedbackSuccess: 'Votre idée a été ajoutée au tableau pour cette session.',
    feedbackBoardKicker: 'Demandes de fonctionnalités',
    feedbackBoardTitle: 'Idées de la communauté',
    feedbackStatusPlanned: 'Prévu',
    feedbackStatusReviewing: 'En revue',
    feedbackStatusOpen: 'Ouvert',
    feedbackIdeaOfflineTitle: 'Mode d’écriture hors ligne',
    feedbackIdeaOfflineBody:
      'Permettre au journal de rester utilisable sans connexion, puis de se synchroniser proprement au retour en ligne.',
    feedbackIdeaPromptsTitle: 'Prompts d’écriture personnalisés',
    feedbackIdeaPromptsBody:
      'Suggérer des prompts depuis l’historique, les tags et les thèmes récurrents sans imposer un suivi d’habitude rigide.',
    feedbackIdeaSharingTitle: 'Collections publiques partagées',
    feedbackIdeaSharingBody:
      'Regrouper des pensées publiques choisies dans une collection soignée à partager avec une audience limitée.',
    feedbackVote: 'Voter',
    feedbackVoted: 'Voté',
    feedbackVoteAria: 'Voter pour {title}',
    blogEyebrow: 'Blog Thoughty',
    blogTitle: 'Actualités, conseils et inspiration pour écrire.',
    blogSubtitle:
      'Lisez des notes produit, des méthodes d’écriture pratiques et des prompts pour que Thoughty reste utile après la première semaine.',
    blogIndexKicker: 'Derniers articles',
    blogIndexTitle: 'Depuis le bureau du journal',
    blogCategoryUpdate: 'Actualité produit',
    blogCategoryTips: 'Conseils de journal',
    blogCategoryInspiration: 'Inspiration',
    blogUpdateTitle: 'Ce qui a changé dans Thoughty ce mois-ci',
    blogUpdateExcerpt:
      'Un aperçu des pages publiques, de la navigation plus claire et des espaces de support qui rendent l’application plus fiable.',
    blogUpdateBody:
      'Ce mois-ci se concentre sur la partie publique de Thoughty : des pages À propos, Confidentialité, Conditions, Contact, Feedback et Blog plus claires pour comprendre le produit avant de créer un compte.',
    blogUpdateDate: 'Juin 2026',
    blogTipsTitle: 'Une revue hebdomadaire simple et légère',
    blogTipsExcerpt:
      'Utilisez tags, favoris et statistiques pour relire une semaine sans transformer votre journal en rapport.',
    blogTipsBody:
      'Choisissez trois entrées de la semaine : une décision utile, une question ouverte et un moment à garder. Ajoutez-les aux favoris, taguez le thème, puis laissez les statistiques montrer les tendances après l’écriture.',
    blogTipsDate: 'Guide',
    blogInspirationTitle: 'Prompts pour écrire quand la journée est bruyante',
    blogInspirationExcerpt:
      'Trois prompts calmes pour sortir les pensées sans exiger une entrée parfaite ou une conclusion nette.',
    blogInspirationBody:
      'Commencez par ce qui occupe encore votre attention, ce qui peut attendre demain et ce que votre futur vous devrait retenir. Une entrée utile peut être courte, inachevée et quand même précieuse.',
    blogInspirationDate: 'Série de prompts',
    blogRead: 'Lire',
    blogReading: 'En lecture',
    suggestTags: 'Auto-Tags',
    suggestingTags: 'Tagging...',
    fixWriting: 'Reformuler',
    fixingWriting: 'Reformulation...',
    discussEntry: 'Discuter avec l\'IA',
    rephraseEntry: 'Reformuler l\'entrée',
    rephrasingEntry: 'Reformulation en cours...',
    rephraseGrammarOnly: 'Grammaire et forme seulement',
    rephraseStyleLight: 'Légères améliorations de style',
    rephraseCompleteRewrite: 'Réécriture complète',
    aiChat: 'Chat IA',
    aiThinking: 'Réflexion...',
    aiLoadingHistory: 'Chargement de l\'historique du chat...',
    aiChatPlaceholder: 'Posez une question sur cette entrée...',
    aiChatError: 'Impossible d\'obtenir une réponse. Vérifiez votre clé API OpenRouter et réessayez.',
    exportChatHistory: 'Exporter le chat',

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
    backlinks: 'Rétroliens',
    backlinksCount: '{count} liens',
    loadingBacklinks: 'Chargement des rétroliens...',
    noBacklinks: 'Aucun rétrolien pour le moment',
    entryNotFound: 'Entrée non trouvée',
    entryNotFoundMessage: 'Cette entrée a peut-être été supprimée, ou le lien n\'est plus valide.',
    entryReferenceHint:
      'Astuce : Référencez d\'autres entrées en écrivant "[[yyyy-mm-dd]]" ou "[[yyyy-mm-dd#X]]" où X est l\'index de l\'entrée pour ce jour',

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
    bulkRephrase: 'Reformuler',
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
    attachmentTypeNotAllowed: "Ce type de fichier n'est pas autorisé. Autorisés : images, audio, PDF, texte brut.",
    attachmentTooLarge: 'Le fichier est trop volumineux. Taille maximale : 5 Mo.',
    previewAttachment: 'Apercu',
    downloadAttachment: 'Télécharger la pièce jointe',
    closeImage: "Fermer l'image",
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    pinEntry: 'Épingler l\'entrée',
    unpinEntry: 'Désépingler l\'entrée',
    pinned: 'Épinglée',
    pinnedEntries: 'Entrées épinglées',
    favorites: 'Favoris',
    filterFavorites: 'Afficher les favoris uniquement',
    archive: 'Archiver l\'entrée',
    unarchive: 'Restaurer l\'entrée',
    archived: 'Archivée',
    activeEntries: 'Actives',
    filterArchived: 'Filtrer les entrées archivées',
    bulkArchive: 'Archiver',
    bulkUnarchive: 'Désarchiver',
    entryPermalink: 'Ouvrir le permalien de l\'entrée',
    shareEntry: 'Partager l\'entrée',
    entryLinkCopied: 'Lien de l\'entrée copié',
    moreActions: 'Plus d\'actions',
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
    subscriptionManagement: 'Abonnement',
    subscriptionCurrentPlan: 'Offre actuelle',
    subscriptionPlan: 'Offre',
    subscriptionPlanDescription: 'Choisissez le niveau d\'abonnement enregistré pour ce compte',
    subscriptionPlanFree: 'Gratuit',
    subscriptionPlanPlus: 'Plus',
    subscriptionPlanPro: 'Pro',
    subscriptionPrice: 'Prix',
    subscriptionRenewal: 'Renouvellement',
    subscriptionMonthly: 'Mensuel',
    subscriptionNoRenewal: 'Aucun renouvellement',
    subscriptionPaymentMethod: 'Moyen de paiement',
    subscriptionPaymentMethodDescription: 'Enregistrez le libellé du moyen de paiement affiché dans la facturation',
    subscriptionNoPaymentMethod: 'Aucun moyen de paiement',
    billingHistory: 'Historique de facturation',
    billingHistoryDescription: 'Factures récentes du compte',
    billingDate: 'Date',
    billingDescription: 'Description',
    billingAmount: 'Montant',
    billingStatus: 'Statut',
    subscriptionPaid: 'Payé',
    subscriptionIncluded: 'Inclus',
    subscriptionPreviousCycle: 'Cycle de facturation précédent',
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
