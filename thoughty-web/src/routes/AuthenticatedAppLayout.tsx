import { useMemo, useRef, type ReactNode } from 'react';
import NavMenu from '../components/NavMenu/NavMenu';
import AutoDismiss from '../components/AutoDismiss/AutoDismiss';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import Footer from '../components/Footer/Footer';
import AiChatModal, { type AiChatModalProps } from '../components/AiChatModal/AiChatModal';
import NoticeToast from '../components/NoticeToast/NoticeToast';
import OfflineNotice from '../components/OfflineNotice/OfflineNotice';
import QuickCaptureDialog from '../components/QuickCapture/QuickCaptureDialog';
import type { QuickCaptureState } from '../components/QuickCapture/useQuickCapture';
import type { ViewType, Config, Entry } from '../types';
import { normalizeFontSize, resolveFontFamily } from '../types/config';
import { useRouteChangeFocus } from '../hooks/useRouteChangeFocus';
import { usePrivacyBlur } from '../components/PrivacyBlur/usePrivacyBlur';
import { useContentLockController } from '../components/ContentLock/useContentLockController';
import { ContentLockContext, type ContentLockApi } from '../components/ContentLock/contentLockContext';
import { QuietModeContext } from '../components/QuietMode/quietMode';
import { resolveLanguage } from '../utils/language';
import { pluralPhrase } from '../utils/pluralPhrase';
import { tintedTextClass } from '../utils/tintedText';
import type { TransientMessage } from '../hooks/useTransientMessage';
import type { NoticeAction } from '../hooks/useAppNotice';

interface AuthenticatedAppLayoutProps {
  readonly children: ReactNode;
  readonly config: Config;
  readonly currentView: ViewType;
  readonly userName: string;
  readonly avatarUrl?: string;
  readonly isEmailVerified?: boolean;
  /** Set while the journal is open without the API having confirmed the session. */
  readonly offline?: boolean;
  readonly onViewChange: (view: ViewType) => void;
  readonly onLogout: () => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly deleteModalOpen: boolean;
  readonly onCloseDeleteModal: () => void;
  readonly onConfirmDelete: () => void;
  readonly bulkModalOpen: boolean;
  readonly onCloseBulkModal: () => void;
  readonly onConfirmBulkDelete: () => void;
  readonly selectedCount: number;
  readonly entryToast: TransientMessage;
  /** The outcome of an entry action, such as a failed save or a bulk summary. */
  readonly notice: TransientMessage;
  readonly noticeText: string;
  /** The button the notice offers, such as Undo after entries went to the recycle bin. */
  readonly noticeAction?: NoticeAction | null;
  readonly chatEntry: Entry | null;
  readonly onCloseChat: () => void;
  readonly onLoadChatHistory: AiChatModalProps['onLoadHistory'];
  readonly onSendChat: AiChatModalProps['onSend'];
  /** The quick capture box, which the navigation's button and its shortcut open on every page. */
  readonly quickCapture?: QuickCaptureState;
  /** The notifications bell in the navigation, built where the router and the session are at hand. */
  readonly notifications?: ReactNode;
  /** Unread messages, counted in the navigation. */
  readonly unreadMessages?: number;
}

function AuthenticatedAppLayout({
  children,
  config,
  currentView,
  userName,
  avatarUrl,
  isEmailVerified,
  offline = false,
  onViewChange,
  onLogout,
  t,
  deleteModalOpen,
  onCloseDeleteModal,
  onConfirmDelete,
  bulkModalOpen,
  onCloseBulkModal,
  onConfirmBulkDelete,
  selectedCount,
  entryToast,
  notice,
  noticeText,
  noticeAction = null,
  chatEntry,
  onCloseChat,
  onLoadChatHistory,
  onSendChat,
  quickCapture,
  notifications,
  unreadMessages,
}: Readonly<AuthenticatedAppLayoutProps>) {
  const mainContentRef = useRef<HTMLElement>(null);
  const appTypographyStyle = {
    fontFamily: resolveFontFamily(config.fontFamily),
    fontSize: `${normalizeFontSize(config.fontSize)}px`,
  };

  useRouteChangeFocus(currentView, mainContentRef);
  const contentLock = useContentLockController({ isDark: config.theme !== 'light', language: resolveLanguage(config.language), t });
  const { api: lockApi } = contentLock;
  // Lifting the blur over locked entries asks for the PIN; blurring again locks them at once
  const privacyBlur = usePrivacyBlur({
    beforeShow: lockApi.hasLockedContent && !lockApi.unlocked ? lockApi.requestUnlock : undefined,
    onBlur: () => void lockApi.lock(),
  });
  const { show: showText } = privacyBlur;
  const contentLockApi = useMemo((): ContentLockApi => ({
    ...lockApi,
    unblur: async () => {
      if (await lockApi.requestUnlock()) showText();
    },
  }), [lockApi, showText]);
  const logOut = () => {
    void lockApi.lock().finally(onLogout);
  };
  const isLight = config.theme === 'light';
  // Simple memoir mode shows one question and nothing else of the app: no menu, quick capture or footer
  const chromeless = currentView === 'memoirSimple';
  const toastClassName = `pointer-events-auto rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${isLight ? 'border-amber-200 bg-white/95 text-gray-900' : 'border-amber-400/30 bg-gray-800/95 text-gray-100'}`;
  const toastTextClassName = isLight ? 'text-gray-600' : 'text-gray-300';

  const focusMainContent = () => {
    document.getElementById('main-content')?.focus();
  };

  return (
    <QuietModeContext.Provider value={config.quietMode === true}>
      <ContentLockContext.Provider value={contentLockApi}>
        <div
          className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}
          style={appTypographyStyle}
        >
          <a href="#main-content" className="skip-link" onClick={focusMainContent}>
            {t('skipToContent')}
          </a>
          <div className="max-w-7xl mx-auto">
            {!chromeless && <NavMenu
              currentView={currentView}
              onViewChange={onViewChange}
              theme={config.theme ?? 'dark'}
              name={userName}
              avatarUrl={avatarUrl}
              isEmailVerified={isEmailVerified}
              t={t}
              onLogout={logOut}
              privacyBlur={privacyBlur}
              quickCapture={quickCapture}
              notifications={notifications}
              unreadMessages={unreadMessages}
            />}

            {quickCapture && !chromeless && <QuickCaptureDialog quickCapture={quickCapture} theme={config.theme} t={t} />}

            <ConfirmModal
              isOpen={deleteModalOpen}
              onClose={onCloseDeleteModal}
              onConfirm={onConfirmDelete}
              title={t('deleteEntryTitle')}
              message={t('deleteEntryMessage')}
              theme={config.theme}
              t={t}
            />

            <ConfirmModal
              isOpen={bulkModalOpen}
              onClose={onCloseBulkModal}
              onConfirm={onConfirmBulkDelete}
              title={t('bulkDeleteTitle')}
              message={pluralPhrase(t, 'bulkDeleteMessage', selectedCount, resolveLanguage(config.language))}
              theme={config.theme}
              t={t}
            />

            <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
              <AutoDismiss message={entryToast} durationMs={4000}>
                <div role="alert" aria-live="assertive" className={toastClassName}>
                  <p className={`text-sm font-semibold ${tintedTextClass('amber', config.theme)}`}>{t('entryNotFound')}</p>
                  <p className={`mt-1 text-sm ${toastTextClassName}`}>{t('entryNotFoundMessage')}</p>
                </div>
              </AutoDismiss>
              <NoticeToast notice={notice} text={noticeText} action={noticeAction} theme={config.theme} className={toastClassName} />
            </div>

            {chatEntry && (
              <AiChatModal
                entry={chatEntry}
                isOpen={!!chatEntry}
                onClose={onCloseChat}
                onLoadHistory={onLoadChatHistory}
                onSend={onSendChat}
                theme={config.theme}
                t={t}
              />
            )}

            {contentLock.dialog}

            <OfflineNotice offline={offline} theme={config.theme} t={t} />

            {/* A change of the unlock draws the view again, reading entries with or without it */}
            <main key={contentLock.epoch} id="main-content" ref={mainContentRef} tabIndex={-1}>
              {children}
            </main>

            {!chromeless && <Footer t={t} theme={config.theme ?? 'dark'} />}
          </div>
        </div>
      </ContentLockContext.Provider>
    </QuietModeContext.Provider>
  );
}

export default AuthenticatedAppLayout;
